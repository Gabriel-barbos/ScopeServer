import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));


const FREE_TIER_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";


const REQUEST_TIMEOUT = 15_000;  
const PING_TIMEOUT = 5_000;     

const statusCache = {
  result: null,
  timestamp: 0,
  ttl: 60_000, 
};

const blockedKeys = new Map();
const BLOCK_KEY_TTL = 5 * 60_000;

const exhaustedModels = new Map();
const BLOCK_MODEL_TTL = 60_000;


function loadSystemPrompt() {
  const filePath = join(__dirname, "systemPrompt.txt");
  return readFileSync(filePath, "utf-8");
}

const SYSTEM_PROMPT = loadSystemPrompt();

function getApiKeys() {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
  ].filter(Boolean);
}

function getKeyName(index) {
  return index === 0 ? "Principal" : "Secundária";
}


function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function isKeyBlocked(apiKey) {
  const blockedAt = blockedKeys.get(apiKey);
  if (!blockedAt) return false;
  if (Date.now() - blockedAt > BLOCK_KEY_TTL) {
    blockedKeys.delete(apiKey);
    return false;
  }
  return true;
}

function isModelExhausted(apiKey, model) {
  const key = `${apiKey}:${model}`;
  const at = exhaustedModels.get(key);
  if (!at) return false;
  if (Date.now() - at > BLOCK_MODEL_TTL) {
    exhaustedModels.delete(key);
    return false;
  }
  return true;
}

function markKeyBlocked(apiKey) {
  blockedKeys.set(apiKey, Date.now());
}

function markModelExhausted(apiKey, model) {
  exhaustedModels.set(`${apiKey}:${model}`, Date.now());
}

function cacheStatus(result) {
  statusCache.result = result;
  statusCache.timestamp = Date.now();
  return result;
}


export async function generateSupportResponse(dynamicContext, history, currentMessage) {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) throw new Error("Nenhuma API Key encontrada no .env");

  const fullSystemInstruction = dynamicContext
    ? `${SYSTEM_PROMPT}\n\nCONHECIMENTO ESPECÍFICO:\n${dynamicContext}`
    : SYSTEM_PROMPT;

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    })),
    { role: "user", parts: [{ text: currentMessage }] },
  ];

  const requestBody = JSON.stringify({
    system_instruction: { parts: [{ text: fullSystemInstruction }] },
    contents,
  });

  let lastErrorMsg = "Erro desconhecido";

  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const keyName = getKeyName(keyIndex);

    if (isKeyBlocked(apiKey)) {
      console.log(`[Skip] Chave ${keyName} bloqueada recentemente, pulando...`);
      lastErrorMsg = `Chave ${keyName} bloqueada`;
      continue;
    }

    // Loop Interno: modelos
    for (const model of FREE_TIER_MODELS) {
      // Skip modelo com quota esgotada (429 recente)
      if (isModelExhausted(apiKey, model)) {
        console.log(`[Skip] ${model} (${keyName}) — quota esgotada recentemente`);
        continue;
      }

      const endpoint = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        }, REQUEST_TIMEOUT);

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (!text) {
            console.warn(`[Vazio] ${model} (${keyName}) retornou resposta vazia. Tentando próximo...`);
            continue;
          }

          console.log(`[OK] Resposta gerada com ${model} (Chave ${keyName})`);
          return text;
        }

        const errBody = await response.json().catch(() => ({}));

        if (response.status === 403) {
          console.warn(`[403] Chave ${keyName} bloqueada/revogada. Pulando chave...`);
          markKeyBlocked(apiKey);
          lastErrorMsg = `Chave ${keyName} bloqueada`;
          break; // Sai do loop de modelos → próxima chave
        }

        if (response.status === 429) {
          console.warn(`[429] Quota ${model} (${keyName}) esgotada. Próximo modelo...`);
          markModelExhausted(apiKey, model);
          lastErrorMsg = "Cotas excedidas";
          continue; // Próximo modelo
        }

        if (response.status >= 500) {
          console.warn(`[${response.status}] Erro servidor Google no ${model}. Próximo modelo...`);
          lastErrorMsg = `Erro servidor (${response.status})`;
          continue;
        }

        console.warn(`[${response.status}] ${model} (${keyName}):`, JSON.stringify(errBody));
        lastErrorMsg = `Erro ${response.status} no ${model}`;
        continue;

      } catch (error) {
        if (error.name === "AbortError") {
          console.warn(`[Timeout] ${model} (${keyName}) não respondeu em ${REQUEST_TIMEOUT / 1000}s`);
          lastErrorMsg = "Timeout na requisição";
        } else {
          console.error(`[Rede] ${model} (${keyName}):`, error.message);
          lastErrorMsg = `Falha de rede: ${error.message}`;
        }
        continue; 
      }
    }
  }

  throw new Error(`Todas as chaves e modelos esgotados. Último status: ${lastErrorMsg}`);
}


export async function checkGeminiStatus() {
  if (statusCache.result && Date.now() - statusCache.timestamp < statusCache.ttl) {
    return statusCache.result;
  }

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    return cacheStatus({ status: "offline", detail: "Nenhuma API Key configurada" });
  }

  const results = [];

  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const keyName = getKeyName(keyIndex);

    if (isKeyBlocked(apiKey)) {
      results.push({ keyName, status: "blocked" });
      continue;
    }

    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`;
      const listResponse = await fetchWithTimeout(listUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }, PING_TIMEOUT);

      if (!listResponse.ok) {
        if (listResponse.status === 403) {
          markKeyBlocked(apiKey);
          results.push({ keyName, status: "blocked" });
        } else {
          results.push({ keyName, status: "error", code: listResponse.status });
        }
        continue;
      }

      const pingResult = await quickModelPing(apiKey, keyName);
      results.push({ keyName, ...pingResult });

      if (pingResult.status === "online") {
        return cacheStatus({
          status: "online",
          detail: `Operacional via Chave ${keyName} (${pingResult.model})`,
        });
      }

    } catch (error) {
      results.push({
        keyName,
        status: error.name === "AbortError" ? "timeout" : "network_error",
      });
    }
  }

  const hasBlocked = results.some(r => r.status === "blocked");
  const hasExhausted = results.some(r => r.status === "quota_exhausted");

  if (hasBlocked && results.length === 1) {
    return cacheStatus({ status: "offline", detail: "Chave única bloqueada/revogada" });
  }
  if (hasExhausted) {
    return cacheStatus({ status: "degraded", detail: "Quota esgotada, aguardando reset" });
  }
  if (hasBlocked) {
    return cacheStatus({ status: "degraded", detail: "Chave primária inoperante, usando backup" });
  }

  return cacheStatus({ status: "offline", detail: "Nenhuma chave ou modelo disponível" });
}


async function quickModelPing(apiKey, keyName) {
  const modelsToTest = FREE_TIER_MODELS.slice(0, 2); 

  for (const model of modelsToTest) {
    if (isModelExhausted(apiKey, model)) continue;

    try {
      const endpoint = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      }, PING_TIMEOUT);

      if (response.ok) return { status: "online", model };

      if (response.status === 429) {
        markModelExhausted(apiKey, model);
        continue;
      }

      return { status: "error", code: response.status };
    } catch {
      return { status: "network_error" };
    }
  }

  return { status: "quota_exhausted" };
}