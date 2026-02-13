import { Router } from "express";
import ReportController from "../controllers/ReportController.js";

const router = Router();

router.get("/", ReportController.getReportData);
router.post("/export", ReportController.exportData);
export default router;