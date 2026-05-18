import { Router } from "express";
import { parseClientIdsFromInput } from "../services/reportAggregations.js";

const router = Router();

router.get("/export-test", async (req, res) => {
  const {
    type          = "services",
    includeOldData = "false",
    dateFrom,
    dateTo,
  } = req.query;
  const clientIds = parseClientIdsFromInput(req.query);

  const params = {
    type,
    includeOldData: includeOldData === "true",
    dateFrom: dateFrom || null,
    dateTo:   dateTo   || null,
    clientIds: clientIds.length > 0 ? clientIds : null,
  };

  console.log("🧪 [export-test] params:", params);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename  = `test-${type}-${includeOldData === "true" ? "com-legado-" : ""}${timestamp}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

  try {
    await streamExcelExport(params, res);
    console.log("✅ [export-test] stream concluído");
  } catch (err) {
    console.error("❌ [export-test] erro no stream:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;