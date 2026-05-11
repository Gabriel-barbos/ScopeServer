import express from "express";
import exceljs from "exceljs";
import PollOrchestrator from "../services/PollOrchestrator.js";
import getPollHistoryModel from "../models/PollHistory.js";
import getPollExecutionModel from "../models/PollExecution.js";

const router = express.Router();

// GET /api/jarvis/poll/status — Estado atual + última execução
router.get("/status", async (req, res) => {
  try {
    const PollExecution = await getPollExecutionModel();
    const lastExecution = await PollExecution.findOne().sort({ startedAt: -1 });

    res.json({
      isRunning: PollOrchestrator.isRunning(),
      lastExecution: lastExecution || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jarvis/poll/executions — Log de execuções (últimas 20)
router.get("/executions", async (req, res) => {
  try {
    const PollExecution = await getPollExecutionModel();
    const executions = await PollExecution.find()
      .sort({ startedAt: -1 })
      .limit(20);

    res.json(executions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jarvis/poll/history — Histórico de veículos (paginado)
router.get("/history", async (req, res) => {
  try {
    const PollHistory = await getPollHistoryModel();
    const { status, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const total = await PollHistory.countDocuments(filter);
    const items = await PollHistory.find(filter)
      .sort({ lastPollDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jarvis/poll/history/maintenance — Somente veículos em manutenção
router.get("/history/maintenance", async (req, res) => {
  try {
    const PollHistory = await getPollHistoryModel();
    const items = await PollHistory.find({ status: "maintenance" })
      .sort({ flaggedAt: -1 });

    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jarvis/poll/export — Exporta relatório em Excel via Streaming
router.get("/export", async (req, res) => {
  try {
    const PollHistory = await getPollHistoryModel();
    const { status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    // Configura os headers para download do arquivo Excel
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=poll_report.xlsx"
    );

    // Cria o workbook e worksheet para streaming
    const options = {
      stream: res,
      useStyles: true,
      useSharedStrings: true,
    };
    const workbook = new exceljs.stream.xlsx.WorkbookWriter(options);
    const worksheet = workbook.addWorksheet("Poll History");

    // Define as colunas
    worksheet.columns = [
      { header: "Vehicle ID", key: "vehicleId", width: 36 },
      { header: "Chassi (VIN)", key: "vin", width: 25 },
      { header: "Descrição", key: "description", width: 40 },
      { header: "Status", key: "status", width: 15 },
      { header: "Total Tentativas", key: "totalAttempts", width: 15 },
      { header: "Última Vez Offline", key: "lastSeenOffline", width: 20 },
      { header: "Último Poll", key: "lastPollDate", width: 20 },
      { header: "Data Manutenção", key: "flaggedAt", width: 20 },
      { header: "Histórico de Tentativas", key: "attempts", width: 50 },
    ];

    // Utiliza cursor para não sobrecarregar a memória
    const cursor = PollHistory.find(filter).sort({ lastPollDate: -1 }).cursor();

    for await (const doc of cursor) {
      // Formata as tentativas em uma string legível
      const attemptsStr = doc.attempts
        .map(
          (a, i) => {
            const dateStr = a.date ? new Date(a.date).toISOString().split("T")[0] : "";
            return `[${i + 1}] ${dateStr} - ${a.success ? "OK" : "ERRO"}`;
          }
        )
        .join(" | ");

      worksheet.addRow({
        vehicleId: doc.vehicleId,
        vin: doc.vin || "",
        description: doc.description || "",
        status: doc.status || "pending",
        totalAttempts: doc.totalAttempts || 0,
        lastSeenOffline: doc.lastSeenOffline ? new Date(doc.lastSeenOffline).toISOString() : "",
        lastPollDate: doc.lastPollDate ? new Date(doc.lastPollDate).toISOString() : "",
        flaggedAt: doc.flaggedAt ? new Date(doc.flaggedAt).toISOString() : "",
        attempts: attemptsStr,
      }).commit(); // commit libera a linha da memória
    }

    worksheet.commit();
    await workbook.commit();
  } catch (err) {
    console.error("[PollRoutes] Erro na exportação:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end(); // Encerra o stream em caso de erro no meio
    }
  }
});

// POST /api/jarvis/poll/run — Trigger manual
router.post("/run", async (req, res) => {
  try {
    if (PollOrchestrator.isRunning()) {
      return res.status(409).json({ error: "Execução já em andamento" });
    }

    // Dispara em background e retorna imediatamente
    res.json({ message: "Execução iniciada", status: "running" });

    // Executa assincronamente
    PollOrchestrator.run("manual").catch((err) => {
      console.error("[PollRoutes] Erro na execução manual:", err.message);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jarvis/poll/reset/:vehicleId — Reseta histórico de um veículo
router.post("/reset/:vehicleId", async (req, res) => {
  try {
    const PollHistory = await getPollHistoryModel();
    const history = await PollHistory.findOne({
      vehicleId: req.params.vehicleId,
    });

    if (!history) {
      return res.status(404).json({ error: "Veículo não encontrado no histórico" });
    }

    history.status = "pending";
    history.totalAttempts = 0;
    history.attempts = [];
    history.flaggedAt = null;
    await history.save();

    res.json({ message: "Histórico resetado", vehicle: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jarvis/poll/cleanup — Corrige execuções travadas em "running"
router.post("/cleanup", async (req, res) => {
  try {
    const PollExecution = await getPollExecutionModel();
    const stuck = await PollExecution.updateMany(
      { status: "running" },
      {
        status: "failed",
        error: "Execução interrompida (cleanup manual)",
        finishedAt: new Date(),
      }
    );

    res.json({
      message: `${stuck.modifiedCount} execução(ões) corrigida(s)`,
      modified: stuck.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/jarvis/poll/clear — Limpa TODOS os dados de poll (para testes)
router.delete("/clear", async (req, res) => {
  try {
    const PollHistory = await getPollHistoryModel();
    const PollExecution = await getPollExecutionModel();

    const [historyResult, executionResult] = await Promise.all([
      PollHistory.deleteMany({}),
      PollExecution.deleteMany({}),
    ]);

    res.json({
      message: "Dados de poll limpos",
      deletedHistories: historyResult.deletedCount,
      deletedExecutions: executionResult.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
