import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const FREE_TIER_MODELS = [
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function loadSystemPrompt() {
  const filePath = join(__dirname, "systemPrompt.txt");
  return readFileSync(filePath, "utf-8");
}

const SYSTEM_PROMPT = loadSystemPrompt();

export async function generateSupportResponse(dynamicContext, history, currentMessage) {
  // 1. Puxa as duas chaves e filtra para montar um array só com as que existem
  const apiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_SECONDARY].filter(Boolean);
  
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

  let lastError;

  // 2. Loop Externo: Itera sobre as chaves de API
  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const keyName = keyIndex === 0 ? "Principal" : "Secundária";

    // 3. Loop Interno: Itera sobre os modelos de fallback
    for (const model of FREE_TIER_MODELS) {
      const endpoint = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: fullSystemInstruction }] },
            contents,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          
          // Se for erro de cota (429) ou bloqueio de permissão da chave (403), força o fallback
          if (response.status === 429 || response.status === 403) {
            throw new Error(`Bloqueio de cota/acesso (${response.status}) para o modelo ${model}`);
          }
          
          // Se for erro na requisição (ex: 400 bad request), interrompe tudo
          throw new Error(`Gemini API error ${response.status} on ${model}: ${JSON.stringify(err)}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;

      } catch (error) {
        console.warn(`[Aviso] Falha na Chave ${keyName} (${model}): ${error.message}. Pulando...`);
        lastError = error;
        
        // Se o erro NÃO for de cota ou bloqueio, joga para o front-end e encerra
        if (!error.message.includes("Bloqueio de cota/acesso")) {
          throw error;
        }
      }
    }
  }

  // 4. Se chegou aqui, ambas as chaves e todos os modelos falharam
  throw new Error(`Todas as chaves e modelos esgotaram a cota. Último erro: ${lastError.message}`);
}

export async function checkGeminiStatus() {
  const apiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_SECONDARY].filter(Boolean);
  if (apiKeys.length === 0) return { status: "offline", detail: "Nenhuma API Key configurada no back-end" };

  let lastStatus = { status: "offline", detail: "Erro desconhecido" };

  // Faz o ping testando as chaves até uma funcionar
  for (const apiKey of apiKeys) {
    const endpoint = `${BASE_URL}/gemini-flash-latest:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 1 }
        }),
      });

      // Se uma chave responder 200 OK, a API inteira está salva e online
      if (response.ok) return { status: "online", detail: "Operacional" };

      if (response.status >= 500) {
        lastStatus = { status: "offline", detail: "Instabilidade nos servidores do Google" };
        continue; // Tenta a próxima chave
      }

      if (response.status === 429 || response.status === 403) {
        lastStatus = { status: "degraded", detail: "Cota excedida, tentando fallback..." };
        continue; // Tenta a próxima chave
      }

      // Se for 400, a payload tá errada
      lastStatus = { status: "offline", detail: `Erro inesperado: Status ${response.status}` };
      break; 

    } catch (error) {
      console.error("Erro ao checar status do Gemini:", error.message);
      lastStatus = { status: "offline", detail: "Falha na conexão de rede" };
    }
  }

  return lastStatus;
}