import { Router } from "express";
import ReportController from "../controllers/ReportController.js";
import { streamExcelExport } from "../services/reportExport.js";

const router = Router();

router.get("/", ReportController.getReportData);
router.post("/export", ReportController.exportData);

// Teste direto via browser/curl — sem frontend
// GET /api/system/reports/export-test?type=services&includeOldData=true
router.get("/export-test", async (req, res) => {
  const { type = "services", includeOldData = "false", dateFrom, dateTo } = req.query;

  const params = {
    type,
    includeOldData: includeOldData === "true",
    dateFrom: dateFrom || null,
    dateTo:   dateTo   || null,
  };

  console.log("🧪 [export-test] iniciando:", params);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename  = `test-${type}-${params.includeOldData ? "com-legado-" : ""}${timestamp}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

  try {
    await streamExcelExport(params, res);
    console.log("✅ [export-test] concluído com sucesso");
  } catch (err) {
    console.error("❌ [export-test] erro:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

export default router;