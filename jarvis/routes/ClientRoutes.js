import express from "express";
import getClientModel from "../models/Client.js";

const router = express.Router();

// Criar client
router.post("/", async (req, res) => {
  try {
    const Client = await getClientModel();
    const { name, login, password, type } = req.body;

    if (!name || !login || !password || !type) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const exists = await Client.findOne({ login });
    if (exists) {
      return res.status(409).json({ error: "Login already exists" });
    }

    const client = await Client.create({
      name,
      login,
      password,
      type,
    });

    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List clients
router.get("/", async (req, res) => {
  try {
    const Client = await getClientModel();
    const clients = await Client.find();
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get client by id
router.get("/:id", async (req, res) => {
  try {
    const Client = await getClientModel();
    const client = await Client.findById(req.params.id).select("-password");

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update client
router.put("/:id", async (req, res) => {
  try {
    const Client = await getClientModel();
    const { name, login, password, type } = req.body;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { name, login, password, type },
      { new: true }
    );

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete client
router.delete("/:id", async (req, res) => {
  try {
    const Client = await getClientModel();
    const client = await Client.findByIdAndDelete(req.params.id);

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    res.json({ message: "Client deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;