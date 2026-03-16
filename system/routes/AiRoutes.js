import { Router } from "express";
import AiController from "../controllers/AiController.js";

const router = Router();

router.post("/chat", AiController.chat);

export default router;