import getKnowledgeBaseModel from "../models/KnowledgeBase.js";
import { generateSupportResponse, checkGeminiStatus } from "../services/geminiService.js";

const AiController = {
  async chat(req, res) {
    try {
      const { mode, category, history = [], message } = req.body;

      if (!mode || !message) {
        return res.status(400).json({ error: "mode e message são obrigatórios" });
      }


      const dynamicContext = await fetchContext(mode, category);
      const reply = await generateSupportResponse(dynamicContext, history, message);

      res.json({ reply });
    } catch (error) {
      console.error("AI chat error:", error.message);
      res.status(500).json({ error: error.message });
    }
  },
  async status(req, res) {
    try {
      const result = await checkGeminiStatus();
      res.json(result); // Retorna o JSON com { status, detail }
    } catch (error) {
      console.error("AI status controller error:", error.message);
      res.status(500).json({ status: "offline", detail: "Erro interno na verificação" });
    }
  }

  
};



async function fetchContext(mode, category) {
  if (!category) return null;

  try {
    const KnowledgeBase = await getKnowledgeBaseModel();
    const docs = await KnowledgeBase.find({ name: category }).lean();
    if (!docs || docs.length === 0) return null;
    return docs.map((d) => d.content).filter(Boolean).join("\n\n---\n\n");
  } catch {
    return null;
  }
}

export default AiController;