import getKnowledgeBaseModel from "../models/KnowledgeBase.js";

const KnowledgeController = {
  async list(req, res) {
    try {
      const KnowledgeBase = await getKnowledgeBaseModel();
      const { mode } = req.params;

      const docs = await KnowledgeBase.find({ mode }).sort({ category: 1 });
      res.json(docs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async findByCategory(req, res) {
    try {
      const KnowledgeBase = await getKnowledgeBaseModel();
      const { mode, category } = req.params;

      const doc = await KnowledgeBase.findOne({ mode, category });
      if (!doc) return res.status(404).json({ error: "Conhecimento não encontrado" });

      res.json(doc);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

async create(req, res) {
  try {
    const KnowledgeBase = await getKnowledgeBaseModel();
    const { name, mode, content } = req.body;

    const doc = await KnowledgeBase.create({ name, mode, content });

    res.status(201).json(doc);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Já existe um registro com esse nome/modo' });
    }
    res.status(500).json({ error: error.message });
  }
},

async update(req, res) {
  try {
    const KnowledgeBase = await getKnowledgeBaseModel();
    const { content } = req.body;

    const doc = await KnowledgeBase.findByIdAndUpdate(
      req.params.id,
      { content },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: 'Conhecimento não encontrado' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
},
  async remove(req, res) {
    try {
      const KnowledgeBase = await getKnowledgeBaseModel();

      const doc = await KnowledgeBase.findByIdAndDelete(req.params.id);
      if (!doc) return res.status(404).json({ error: "Conhecimento não encontrado" });

      res.json({ message: "Conhecimento removido com sucesso" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default KnowledgeController;