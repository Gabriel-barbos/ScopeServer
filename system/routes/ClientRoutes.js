import express from "express";
import getClientModel from "../models/Client.js";
import upload from "../config/multer.js";

const router = express.Router();

// Criar cliente ou subcliente
router.post("/", upload.array("image", 1), async (req, res) => {
  try {
    const { name, description, parent } = req.body;
    const imageUrls = req.files?.map((f) => f.path) ?? [];

    const Client = await getClientModel();

    if (parent) {
      const parentExists = await Client.findById(parent);
      if (!parentExists) {
        return res.status(400).json({ error: "Cliente principal não encontrado" });
      }
      if (parentExists.parent) {
        return res.status(400).json({ error: "Um subcliente não pode ser pai de outro subcliente" });
      }
    }

   
    const type = parent ? "subCliente" : "Cliente";

    const client = await Client.create({
      name,
      description,
      image: imageUrls,
      parent: parent ?? null,
      type,
    });

    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar todos — ?type=client|subclient&parentId=xxx
router.get("/", async (req, res) => {
  try {
    const { type, parentId } = req.query;
    const Client = await getClientModel();

    const filter = {};
    if (type === "client") filter.parent = null;
    if (type === "subclient") filter.parent = { $ne: null };
    if (parentId) filter.parent = parentId;

    const clients = await Client.find(filter).populate("parent", "name");
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar por ID com subclientes
router.get("/:id", async (req, res) => {
  try {
    const Client = await getClientModel();
    const client = await Client.findById(req.params.id).populate("parent", "name");
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

    const subclients = await Client.find({ parent: req.params.id }, "name description image");
    res.json({ ...client.toObject(), subclients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar
router.put("/:id", upload.array("image", 5), async (req, res) => {
  try {
    const { name, description, parent } = req.body;
    const Client = await getClientModel();

    if (parent) {
      if (parent === req.params.id) {
        return res.status(400).json({ error: "Um cliente não pode ser pai de si mesmo" });
      }
      const parentDoc = await Client.findById(parent);
      if (!parentDoc) return res.status(400).json({ error: "Cliente principal não encontrado" });
      if (parentDoc.parent) return res.status(400).json({ error: "Um subcliente não pode ser pai de outro subcliente" });
    }

    // type derivado automaticamente
    const type = parent ? "subCliente" : "Cliente";

    const updatedData = {
      name,
      description,
      parent: parent ?? null,
      type, // ← adicionado
    };

    if (req.files?.length > 0) updatedData.image = req.files.map((f) => f.path);

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      updatedData,
      { new: true }
    ).populate("parent", "name");

    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar
router.delete("/:id", async (req, res) => {
  try {
    const Client = await getClientModel();

    const hasSubclients = await Client.exists({ parent: req.params.id });
    if (hasSubclients) {
      return res.status(400).json({ error: "Remova os subclientes antes de deletar o cliente principal" });
    }

    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

    res.json({ message: "Cliente excluído com sucesso" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;