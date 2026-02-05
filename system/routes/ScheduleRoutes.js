import { Router } from "express";
import ScheduleController from "../controllers/ScheduleController.js";

const router = Router();

router.post("/", ScheduleController.create);
router.post("/bulk", ScheduleController.bulkCreate)
router.put("/bulk", ScheduleController.bulkUpdate);
router.get("/", ScheduleController.list);
router.get("/:id", ScheduleController.findById);
router.put("/:id", ScheduleController.update);
router.patch("/:id/status", ScheduleController.updateStatus);
router.delete("/:id", ScheduleController.delete);

export default router;
