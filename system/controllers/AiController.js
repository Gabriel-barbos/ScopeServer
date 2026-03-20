import getKnowledgeBaseModel from "../models/KnowledgeBase.js";
import { generateSupportResponse } from "../services/geminiService.js";

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
};

async function fetchContext(mode, category) {
  if (mode !== 'duvidas' || !category) return null;

  try {
    const KnowledgeBase = await getKnowledgeBaseModel();
    const doc = await KnowledgeBase.findOne({ name: category });
    return doc?.content ?? null;
  } catch {
    return null;
  }
}

export default AiController;