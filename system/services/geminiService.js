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

  let lastErrorMsg = "Erro desconhecido";

  // Loop Externo: Itera sobre as chaves de API
  for (const [keyIndex, apiKey] of apiKeys.entries()) {
    const keyName = keyIndex === 0 ? "Principal" : "Secundária";

    // Loop Interno: Itera sobre os modelos
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
          
          if (response.status === 403) {
            console.warn(`[Aviso] Chave ${keyName} bloqueada/revogada (403). Pulando para próxima chave...`);
            lastErrorMsg = "Chaves bloqueadas";
            break; 
          }
          
          if (response.status === 429) {
            console.warn(`[Aviso] Cota do ${model} na Chave ${keyName} acabou (429). Tentando próximo modelo...`);
            lastErrorMsg = "Cotas excedidas";
            continue; 
          }
          
          throw new Error(`Gemini API error ${response.status} on ${model}: ${JSON.stringify(err)}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text; 

      } catch (error) {
        // Captura falhas de rede ou erros 400 que lançamos acima
        console.error(`[Erro Crítico] Falha ao processar na Chave ${keyName} (${model}):`, error.message);
        throw error;
      }
    }
  }

  // Se o código chegou aqui embaixo, todas as chaves e modelos falharam
  throw new Error(`O sistema esgotou todas as tentativas de chaves e modelos de backup. Último status: ${lastErrorMsg}`);
}

export async function checkGeminiStatus() {
  const apiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_SECONDARY].filter(Boolean);
  if (apiKeys.length === 0) return { status: "offline", detail: "Nenhuma API Key configurada" };

  let lastStatus = { status: "offline", detail: "Iniciando verificação" };

  // O ping agora também testa todos os modelos antes de desistir
  for (const apiKey of apiKeys) {
    for (const model of FREE_TIER_MODELS) {
      const endpoint = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 1 }
          }),
        });

        // Achou pelo menos UM modelo em UMA chave funcionando? O sistema está online!
        if (response.ok) return { status: "online", detail: "Operacional" };

        if (response.status === 403) {
          lastStatus = { status: "degraded", detail: "Chave primária inoperante, usando backup..." };
          break; // Vai pra próxima chave
        }

        if (response.status === 429) {
          lastStatus = { status: "degraded", detail: "Alta demanda, usando modelos de backup..." };
          continue; // Vai pro próximo modelo
        }

        if (response.status >= 500) {
          lastStatus = { status: "offline", detail: "Instabilidade no Google Cloud" };
          continue; 
        }

        // Se for erro de sintaxe (400), o ping tá errado, mas vamos tentar continuar
        lastStatus = { status: "offline", detail: `Erro inesperado: Status ${response.status}` };
        break; 

      } catch (error) {
        console.error("Erro no ping:", error.message);
        lastStatus = { status: "offline", detail: "Falha na conexão de rede" };
        break; // Erro de rede na chave costuma ser generalizado, pula pra próxima
      }
    }
  }

  return lastStatus;
}