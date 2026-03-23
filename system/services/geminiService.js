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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não encontrada no .env");

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

  // 2. Loop de fallback: tenta um modelo, se der erro 429 (cota), vai para o próximo
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
        
        // Se for erro de cota (429), lança um erro específico para cair no catch e tentar o próximo
        if (response.status === 429) {
          throw new Error(`Quota exceeded for ${model}`);
        }
        
        // Se for erro de sintaxe ou autenticação (ex: 400 ou 401), interrompe tudo
        throw new Error(`Gemini API error ${response.status} on ${model}: ${JSON.stringify(err)}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      console.warn(`[Aviso] Falha ao usar o modelo ${model}: ${error.message}. Tentando o próximo...`);
      lastError = error;
      
      // Se o erro não for de cota estourada, encerra o loop e repassa o erro para a aplicação
      if (!error.message.includes("Quota exceeded")) {
        throw error;
      }
    }
  }

  // 3. Se o loop terminar, significa que todos os modelos esgotaram a cota
  throw new Error(`Todos os modelos do tier gratuito esgotaram a cota. Último erro: ${lastError.message}`);
}

export async function checkGeminiStatus() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { status: "offline", detail: "API Key não configurada" };

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

    if (response.ok) {
      return { status: "online", detail: "Operacional" };
    }

    if (response.status >= 500) {
      return { status: "offline", detail: "Instabilidade nos servidores do Google" };
    }

    if (response.status === 429) {
      return { status: "degraded", detail: "Cota excedida ou limite bloqueado" };
    }

    return { status: "offline", detail: `Erro inesperado: Status ${response.status}` };

  } catch (error) {
    console.error("Erro ao checar status do Gemini:", error.message);
    return { status: "offline", detail: "Falha na conexão de rede" };
  }
}