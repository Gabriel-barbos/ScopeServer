import TokenManager from "./TokenManager.js";
import PollScanner from "./PollScanner.js";
import PollQueue from "./PollQueue.js";
import getPollHistoryModel from "../models/PollHistory.js";
import getPollExecutionModel from "../models/PollExecution.js";

const CREDENTIALS = {
  login: "brazil-support@scopetechnology.com",
  password: "Scope@br2021",
};

// Veículo só é recovered se reportou nas últimas 72h
const RECOVERED_WINDOW_MS = 72 * 60 * 60 * 1000;

// Delay entre GETs de verificação (leve, sem necessidade de 500ms)
const RECOVERED_CHECK_DELAY_MS = 100;

let isRunning = false;

class PollOrchestrator {
  static async run(trigger = "manual") {
    if (isRunning) {
      console.log("[PollOrchestrator] ⚠️ Já existe uma execução em andamento. Abortando.");
      return { error: "Execução já em andamento" };
    }

    isRunning = true;

    const PollExecution = await getPollExecutionModel();
    const PollHistory = await getPollHistoryModel();

    const execution = new PollExecution({
      startedAt: new Date(),
      trigger,
      status: "running",
    });
    await execution.save();

    console.log(`[PollOrchestrator] 🚀 Iniciando execução (trigger: ${trigger})`);

    try {
      const tokenManager = new TokenManager(CREDENTIALS);
      const scanner = new PollScanner({ tokenManager });
      const queue = new PollQueue({ tokenManager });

      // IDs que aparecem offline nesta varredura
      const offlineVehicleIds = new Set();

      let totalPolled = 0;
      let totalSkipped = 0;
      let totalNewMaintenance = 0;
      let totalErrors = 0;

      // 1. Varredura + poll para veículos offline
      const scanStats = await scanner.scan(async (activeVehicles, pageStats) => {
        for (const v of activeVehicles) {
          offlineVehicleIds.add(v.id);
        }

        const queueResult = await queue.process(activeVehicles);

        totalPolled         += queueResult.polled;
        totalSkipped        += queueResult.skipped;
        totalNewMaintenance += queueResult.newMaintenance;
        totalErrors         += queueResult.errors;

        console.log(
          `[PollOrchestrator] Página ${pageStats.page} processada: ` +
          `${queueResult.polled} polls, ${queueResult.skipped} skip, ` +
          `${queueResult.newMaintenance} manutenção, ${queueResult.errors} erros`
        );
      });

      // 2. Verifica veículos pending que sumiram da varredura
      const { totalRecovered, stillOfflineVehicles } = await PollOrchestrator.#checkRecovered(
        PollHistory,
        scanner,
        offlineVehicleIds
      );

      // 3. Envia poll para os que sumiram da varredura mas ainda não voltaram
      if (stillOfflineVehicles.length > 0) {
        console.log(
          `[PollOrchestrator] Enviando poll para ${stillOfflineVehicles.length} veículos ` +
          `pending ausentes da varredura...`
        );

        const extraResult = await queue.process(stillOfflineVehicles);

        totalPolled         += extraResult.polled;
        totalSkipped        += extraResult.skipped;
        totalNewMaintenance += extraResult.newMaintenance;
        totalErrors         += extraResult.errors;
      }

      // 4. Salva log de execução
      execution.finishedAt          = new Date();
      execution.status              = "completed";
      execution.totalScanned        = scanStats.totalScanned;
      execution.totalPolled         = totalPolled;
      execution.totalSkipped        = totalSkipped;
      execution.totalNewMaintenance = totalNewMaintenance;
      execution.totalRecovered      = totalRecovered;
      execution.totalErrors         = totalErrors;
      execution.tokenRefreshCount   = tokenManager.getStats().refreshCount;
      execution.pagesProcessed      = scanStats.pagesProcessed;
      await execution.save();

      const duration = ((execution.finishedAt - execution.startedAt) / 1000 / 60).toFixed(1);

      console.log(`[PollOrchestrator] ✅ Execução concluída em ${duration} min`);
      console.log(`[PollOrchestrator] Resumo:`, {
        totalScanned:        scanStats.totalScanned,
        totalActive:         scanStats.totalActive,
        totalDeactivated:    scanStats.totalDeactivated,
        totalPolled,
        totalSkipped,
        totalNewMaintenance,
        totalRecovered,
        totalErrors,
        tokenRefreshes:      tokenManager.getStats().refreshCount,
      });

      return execution.toObject();
    } catch (err) {
      console.error("[PollOrchestrator] ❌ Erro fatal:", err.message);

      execution.finishedAt = new Date();
      execution.status     = "failed";
      execution.error      = err.message;
      await execution.save();

      return execution.toObject();
    } finally {
      isRunning = false;
    }
  }

  /**
   * Para cada veículo pending que NÃO apareceu na varredura offline desta execução,
   * consulta a API para verificar o lastKnownEventUtcTimestamp.
   *
   * - Reportou nas últimas 72h → recovered (confirmado via API)
   * - Não reportou → stillOffline: recebe poll nessa execução normalmente
   *
   * Veículos em maintenance são ignorados (já tratados pelo PollQueue).
   *
   * @returns {{ totalRecovered: number, stillOfflineVehicles: Array }}
   *   stillOfflineVehicles tem o formato mínimo que PollQueue.process() espera: { id, vin, description }
   */
  static async #checkRecovered(PollHistory, scanner, offlineVehicleIds) {
    const pendingVehicles = await PollHistory.find({ status: "pending" });

    // Candidatos: pending e ausentes da varredura atual
    const candidates = pendingVehicles.filter(
      (ph) => !offlineVehicleIds.has(ph.vehicleId)
    );

    if (candidates.length === 0) {
      console.log("[PollOrchestrator] Nenhum candidato a recovered.");
      return { totalRecovered: 0, stillOfflineVehicles: [] };
    }

    console.log(
      `[PollOrchestrator] Verificando ${candidates.length} candidatos via API...`
    );

    const cutoff = new Date(Date.now() - RECOVERED_WINDOW_MS);
    let totalRecovered = 0;
    const stillOfflineVehicles = [];

    for (const ph of candidates) {
      const timestamp = await scanner.fetchVehicleTimestamp(ph.vehicleId);

      if (!timestamp) {
        // Falha na consulta — mantém pending e tenta poll
        console.warn(
          `[PollOrchestrator] ⚠️ Sem timestamp para ${ph.vin || ph.vehicleId} — mantendo pending`
        );
        stillOfflineVehicles.push({
          id:          ph.vehicleId,
          vin:         ph.vin,
          description: ph.description,
        });
        await new Promise((r) => setTimeout(r, RECOVERED_CHECK_DELAY_MS));
        continue;
      }

      const lastEvent = new Date(timestamp);

      if (lastEvent > cutoff) {
        // Confirmado: voltou a reportar dentro da janela de 72h
        ph.status        = "recovered";
        ph.recoveredAt   = lastEvent;
        ph.totalAttempts = 0;
        ph.attempts      = [];
        await ph.save();
        totalRecovered++;

        console.log(
          `[PollOrchestrator] ✅ RECUPERADO: ${ph.vin || ph.vehicleId} ` +
          `(último evento: ${lastEvent.toISOString()})`
        );
      } else {
        // Ainda não voltou — envia poll nessa execução
        stillOfflineVehicles.push({
          id:          ph.vehicleId,
          vin:         ph.vin,
          description: ph.description,
        });

        console.log(
          `[PollOrchestrator] ⏳ Ainda sem retorno: ${ph.vin || ph.vehicleId} ` +
          `(último evento: ${lastEvent.toISOString()})`
        );
      }

      await new Promise((r) => setTimeout(r, RECOVERED_CHECK_DELAY_MS));
    }

    console.log(
      `[PollOrchestrator] Verificação concluída: ` +
      `${totalRecovered} recovered, ${stillOfflineVehicles.length} ainda offline`
    );

    return { totalRecovered, stillOfflineVehicles };
  }

  static isRunning() {
    return isRunning;
  }
}

export default PollOrchestrator;