import express from "express";
import { initRoutineModel } from "../models/Routine.js";
import { initClientModel } from "../models/Client.js";


const router = express.Router();
let Routine;

router.use(async (_, __, next) => {
  if (!Routine) {
  
    await initClientModel();      // registra Client na conexão
    Routine = await initRoutineModel(); // registra Routine
  }
  next();
});

//create a new routine
router.post("/", async (req, res) => {
  try {
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

//list all routines
router.get("/", async (req, res) => {
  try {
    const routines = await Routine.find()
      .populate("client", "name login password");

    res.json(routines);
  } catch (error) {
    res.status(500).json({
      message: "Erro ao listar rotinas",
      error: error.message,
    });
  }
});

//get routine by id
router.get("/:id", async (req, res) => {
  try {
    const routine = await Routine.findById(req.params.id)
      .populate("client", "name login password");

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

//update routine by id
router.put("/:id", async (req, res) => {
  try {
    const routine = await Routine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

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

//delete routine by id
router.delete("/:id", async (req, res) => {
  try {
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
