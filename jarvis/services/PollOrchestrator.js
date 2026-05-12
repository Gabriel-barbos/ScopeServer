import TokenManager from "./TokenManager.js";
import PollScanner from "./PollScanner.js";
import PollQueue from "./PollQueue.js";
import getPollHistoryModel from "../models/PollHistory.js";
import getPollExecutionModel from "../models/PollExecution.js";

const CREDENTIALS = {
  login: "brazil-support@scopetechnology.com",
  password: "Scope@br2021",
};

// Janela para considerar um veículo recuperado:
// o lastKnownEventUtcTimestamp deve ser mais recente que 72h atrás
const RECOVERED_WINDOW_MS = 72 * 60 * 60 * 1000;

// Delay entre verificações de recovered (GET leve, sem necessidade de 500ms)
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

      const offlineVehicleIds = new Set();

      let totalPolled = 0;
      let totalSkipped = 0;
      let totalNewMaintenance = 0;
      let totalErrors = 0;

      const scanStats = await scanner.scan(async (activeVehicles, pageStats) => {
        for (const v of activeVehicles) {
          offlineVehicleIds.add(v.id);
        }

        const queueResult = await queue.process(activeVehicles);

        totalPolled += queueResult.polled;
        totalSkipped += queueResult.skipped;
        totalNewMaintenance += queueResult.newMaintenance;
        totalErrors += queueResult.errors;

        console.log(
          `[PollOrchestrator] Página ${pageStats.page} processada: ` +
          `${queueResult.polled} polls, ${queueResult.skipped} skip, ` +
          `${queueResult.newMaintenance} manutenção, ${queueResult.errors} erros`
        );
      });

      // Detecção de veículos recuperados — com verificação real via API
      const totalRecovered = await PollOrchestrator.#checkRecovered(
        PollHistory,
        scanner,
        offlineVehicleIds
      );

      execution.finishedAt = new Date();
      execution.status = "completed";
      execution.totalScanned = scanStats.totalScanned;
      execution.totalPolled = totalPolled;
      execution.totalSkipped = totalSkipped;
      execution.totalNewMaintenance = totalNewMaintenance;
      execution.totalRecovered = totalRecovered;
      execution.totalErrors = totalErrors;
      execution.tokenRefreshCount = tokenManager.getStats().refreshCount;
      execution.pagesProcessed = scanStats.pagesProcessed;
      await execution.save();

      const duration = ((execution.finishedAt - execution.startedAt) / 1000 / 60).toFixed(1);

      console.log(`[PollOrchestrator] ✅ Execução concluída em ${duration} min`);
      console.log(`[PollOrchestrator] Resumo:`, {
        totalScanned: scanStats.totalScanned,
        totalActive: scanStats.totalActive,
        totalDeactivated: scanStats.totalDeactivated,
        totalPolled,
        totalSkipped,
        totalNewMaintenance,
        totalRecovered,
        totalErrors,
        tokenRefreshes: tokenManager.getStats().refreshCount,
      });

      return execution.toObject();
    } catch (err) {
      console.error("[PollOrchestrator] ❌ Erro fatal:", err.message);

      execution.finishedAt = new Date();
      execution.status = "failed";
      execution.error = err.message;
      await execution.save();

      return execution.toObject();
    } finally {
      isRunning = false;
    }
  }

  /**
   * Para cada veículo pending que NÃO apareceu na varredura offline,
   * consulta a API para verificar se o lastKnownEventUtcTimestamp
   * é recente (dentro de RECOVERED_WINDOW_MS).
   *
   * Um veículo só é marcado recovered se a API confirmar que ele
   * reportou dentro da janela esperada. Caso contrário, permanece pending.
   *
   * @param {Model} PollHistory
   * @param {PollScanner} scanner
   * @param {Set<string>} offlineVehicleIds - IDs que ainda estão offline nesta execução
   * @returns {number} total de veículos confirmados como recovered
   */
  static async #checkRecovered(PollHistory, scanner, offlineVehicleIds) {
    // Candidatos: pending e que não apareceram na lista de offline
    const pendingVehicles = await PollHistory.find({ status: "pending" });
    const candidates = pendingVehicles.filter(
      (ph) => !offlineVehicleIds.has(ph.vehicleId)
    );

    if (candidates.length === 0) {
      console.log("[PollOrchestrator] Nenhum candidato a recovered para verificar.");
      return 0;
    }

    console.log(
      `[PollOrchestrator] Verificando ${candidates.length} candidatos a recovered via API...`
    );

    const cutoff = new Date(Date.now() - RECOVERED_WINDOW_MS);
    let totalRecovered = 0;

    for (const ph of candidates) {
      const timestamp = await scanner.fetchVehicleTimestamp(ph.vehicleId);

      if (!timestamp) {
        // Não conseguiu consultar — mantém pending, não assume nada
        console.log(
          `[PollOrchestrator] ⚠️ Sem timestamp para ${ph.vin || ph.vehicleId} — mantendo pending`
        );
        await new Promise((r) => setTimeout(r, RECOVERED_CHECK_DELAY_MS));
        continue;
      }

      const lastEvent = new Date(timestamp);
      const isRecovered = lastEvent > cutoff;

      if (isRecovered) {
        ph.status = "recovered";
        ph.recoveredAt = lastEvent;
        ph.totalAttempts = 0;
        ph.attempts = [];
        await ph.save();
        totalRecovered++;

        console.log(
          `[PollOrchestrator] ✅ RECUPERADO: ${ph.vin || ph.vehicleId} ` +
          `(último evento: ${lastEvent.toISOString()})`
        );
      } else {
        console.log(
          `[PollOrchestrator] ⏳ Ainda sem retorno: ${ph.vin || ph.vehicleId} ` +
          `(último evento: ${lastEvent.toISOString()})`
        );
      }

      await new Promise((r) => setTimeout(r, RECOVERED_CHECK_DELAY_MS));
    }

    console.log(
      `[PollOrchestrator] Verificação concluída: ${totalRecovered}/${candidates.length} confirmados recovered`
    );

    return totalRecovered;
  }

  static isRunning() {
    return isRunning;
  }
}

export default PollOrchestrator;