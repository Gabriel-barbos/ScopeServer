import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

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

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: fullSystemInstruction }] },
      contents,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}