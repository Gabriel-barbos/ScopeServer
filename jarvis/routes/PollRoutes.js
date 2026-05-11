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

    // Helper para converter a data para fuso do Brasil (GMT-3) mantendo como Date
    // Isso garante que o Excel receba um valor de data/hora que pode ser filtrado nativamente
    const toBrazilDate = (dateVal) => {
      if (!dateVal) return "";
      const d = new Date(dateVal);
      // Subtrai 3 horas para que a representação em UTC seja igual ao horário de Brasília
      d.setUTCHours(d.getUTCHours() - 3);
      return d;
    };

    // Define as colunas (Sem o Vehicle ID e com estilo de número de Data)
    worksheet.columns = [
      { header: "Chassi (VIN)", key: "vin", width: 25 },
      { header: "Descrição", key: "description", width: 40 },
      { header: "Status", key: "status", width: 15 },
      { header: "Total Tentativas", key: "totalAttempts", width: 15 },
      { header: "Data de Identificação (Offline)", key: "lastSeenOffline", width: 28, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: "Último Poll", key: "lastPollDate", width: 20, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: "Data Manutenção", key: "flaggedAt", width: 20, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: "Histórico de Tentativas", key: "attempts", width: 55 },
    ];

    // Estilizar cabeçalho para um visual mais profissional
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' } // Cinza escuro (estilo tailwind gray-800)
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Utiliza cursor para não sobrecarregar a memória
    const cursor = PollHistory.find(filter).sort({ lastPollDate: -1 }).cursor();

    for await (const doc of cursor) {
      // Formata as tentativas em uma string legível com data e hora ajustada
      const attemptsStr = doc.attempts
        .map(
          (a, i) => {
            if (!a.date) return `[${i + 1}] ERRO`;
            const d = toBrazilDate(a.date);
            const day = String(d.getUTCDate()).padStart(2, '0');
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const year = d.getUTCFullYear();
            const hours = String(d.getUTCHours()).padStart(2, '0');
            const mins = String(d.getUTCMinutes()).padStart(2, '0');
            return `[${i + 1}] ${day}/${month}/${year} ${hours}:${mins} - ${a.success ? "OK" : "ERRO"}`;
          }
        )
        .join(" | ");

      worksheet.addRow({
        vin: doc.vin || "",
        description: doc.description || "",
        status: doc.status || "pending",
        totalAttempts: doc.totalAttempts || 0,
        lastSeenOffline: toBrazilDate(doc.lastSeenOffline),
        lastPollDate: toBrazilDate(doc.lastPollDate),
        flaggedAt: toBrazilDate(doc.flaggedAt),
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
