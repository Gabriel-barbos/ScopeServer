import express from "express";
import getRoutineModel from "../models/Routine.js";
import getClientModel from "../models/Client.js";

const router = express.Router();

// Create a new routine
router.post("/", async (req, res) => {
  try {
    // Garante que Client está registrado antes
    await getClientModel();
    const Routine = await getRoutineModel();  
    
    console.log("Payload recebido:", req.body);
    const routine = await Routine.create(req.body);
    res.status(201).json(routine);
  } catch (error) {
    console.error("Erro completo:", error);
    res.status(400).json({
      message: "Erro ao criar rotina",
      error: error.message,
    });
  }
});

// List all routines
router.get("/", async (req, res) => {
  try {
    // 🔑 CHAVE: Garante que Client está registrado ANTES do populate
    await getClientModel();
    const Routine = await getRoutineModel();
    
    const routines = await Routine.find().populate("client", "name login password");

    res.json(routines);
  } catch (error) {
    console.error("Erro ao listar rotinas:", error);
    res.status(500).json({
      message: "Erro ao listar rotinas",
      error: error.message,
    });
  }
});

// Get routine by id
router.get("/:id", async (req, res) => {
  try {
    // Garante que Client está registrado antes
    await getClientModel();
    const Routine = await getRoutineModel();
    
    const routine = await Routine.findById(req.params.id).populate(
      "client",
      "name login password"
    );

    if (!routine) {
      return res.status(404).json({ message: "Rotina não encontrada" });
    }

    res.json(routine);
  } catch (error) {
    res.status(500).json({
      message: "Erro ao buscar rotina",
      error: error.message,
    });
  }
});

// Update routine by id
router.put("/:id", async (req, res) => {
  try {
    const Routine = await getRoutineModel();
    
    const routine = await Routine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!routine) {
      return res.status(404).json({ message: "Rotina não encontrada" });
    }

    res.json(routine);
  } catch (error) {
    res.status(400).json({
      message: "Erro ao atualizar rotina",
      error: error.message,
    });
  }
});

// Delete routine by id
router.delete("/:id", async (req, res) => {
  try {
    const Routine = await getRoutineModel();
    
    const routine = await Routine.findByIdAndDelete(req.params.id);

    if (!routine) {
      return res.status(404).json({ message: "Rotina não encontrada" });
    }

    res.json({ message: "Rotina removida com sucesso" });
  } catch (error) {
    res.status(500).json({
      message: "Erro ao deletar rotina",
      error: error.message,
    });
  }
});

export default router;