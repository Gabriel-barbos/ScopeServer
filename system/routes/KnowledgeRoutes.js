import { Router } from "express";
import KnowledgeController from "../controllers/KnowledgeController.js";

const router = Router();

router.get("/", KnowledgeController.listAll);    
router.get("/:mode", KnowledgeController.list);
router.get("/:mode/:category", KnowledgeController.findByCategory);
router.post("/", KnowledgeController.create);
router.put("/:id", KnowledgeController.update);
router.delete("/:id", KnowledgeController.remove);

export default router;