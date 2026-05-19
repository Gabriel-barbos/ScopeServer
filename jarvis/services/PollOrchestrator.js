import TokenManager from "./TokenManager.js";
import PollScanner, { isVehicleDeactivated } from "./PollScanner.js";
import PollQueue from "./PollQueue.js";
import getPollHistoryModel from "../models/PollHistory.js";
import getPollExecutionModel from "../models/PollExecution.js";

const CREDENTIALS = {
  login: "brazil-support@scopetechnology.com",
  password: "Scope@br2021",
};

const RECOVERED_WINDOW_MS = 72 * 60 * 60 * 1000;
const RECOVERY_CHECK_CONCURRENCY = 10;
const RECOVERY_BATCH_SIZE = 100;
const PROGRESS_SAVE_INTERVAL_MS = 5000;

let isRunning = false;
let stopRequested = false;
let currentExecutionId = null;

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }
  );

  await Promise.all(workers);
  return results;
}

class PollOrchestrator {
  static async run(trigger = "manual") {
    if (isRunning) {
      console.log("[PollOrchestrator] Ja existe uma execucao em andamento. Abortando.");
      return { error: "Execucao ja em andamento" };
    }

    isRunning = true;
    stopRequested = false;

    const PollExecution = await getPollExecutionModel();
    const PollHistory = await getPollHistoryModel();

    const execution = new PollExecution({
      startedAt: new Date(),
      trigger,
      status: "running",
      stage: "starting",
      message: "Iniciando Auto Poll 72h",
    });
    await execution.save();
    currentExecutionId = execution._id;

    let lastProgressSaveAt = 0;
    const shouldStop = () => stopRequested;
    const saveProgress = async (patch = {}, force = false) => {
      Object.assign(execution, patch);

      const now = Date.now();
      if (!force && now - lastProgressSaveAt < PROGRESS_SAVE_INTERVAL_MS) return;

      lastProgressSaveAt = now;
      await execution.save();
    };

    console.log(`[PollOrchestrator] Iniciando execucao (trigger: ${trigger})`);

    try {
      const tokenManager = new TokenManager(CREDENTIALS);
      const scanner = new PollScanner({ tokenManager });
      const queue = new PollQueue({ tokenManager });

      const offlineVehicleIds = new Set();

      let totalPolled = 0;
      let totalSkipped = 0;
      let totalIgnored = 0;
      let totalNewMaintenance = 0;
      let totalErrors = 0;

      await saveProgress({ stage: "scanning", message: "Buscando veiculos offline 72h+" }, true);

      const scanStats = await scanner.scan(
        async (activeVehicles, pageStats) => {
          for (const v of activeVehicles) {
            offlineVehicleIds.add(v.id);
          }

          await saveProgress(
            {
              stage: "polling",
              message: `Processando pagina ${pageStats.page}`,
              pagesProcessed: pageStats.page,
              totalScanned: pageStats.totalScanned,
            },
            true
          );

          const queueResult = await queue.process(activeVehicles, {
            shouldStop,
            onProgress: async (progress) => {
              await saveProgress({
                totalPolled: totalPolled + progress.polled,
                totalSkipped: totalSkipped + progress.skipped,
                totalIgnored: totalIgnored + progress.ignored,
                totalNewMaintenance: totalNewMaintenance + progress.newMaintenance,
                totalErrors: totalErrors + progress.errors,
              });
            },
          });

          totalPolled += queueResult.polled;
          totalSkipped += queueResult.skipped;
          totalIgnored += queueResult.ignored;
          totalNewMaintenance += queueResult.newMaintenance;
          totalErrors += queueResult.errors;

          console.log(
            `[PollOrchestrator] Pagina ${pageStats.page} processada: ` +
              `${queueResult.polled} polls, ${queueResult.skipped} skip, ` +
              `${queueResult.newMaintenance} manutencao, ${queueResult.errors} erros`
          );
        },
        {
          shouldStop,
          onProgress: async (stats) => {
            await saveProgress({
              stage: "scanning",
              message: `Varredura: ${stats.pagesProcessed} pagina(s)`,
              totalScanned: stats.totalScanned,
              totalActive: stats.totalActive,
              totalDeactivated: stats.totalDeactivated,
              pagesProcessed: stats.pagesProcessed,
            });
          },
        }
      );

      if (!shouldStop()) {
        const recoveredResult = await PollOrchestrator.#checkRecovered(
          PollHistory,
          scanner,
          offlineVehicleIds,
          {
            shouldStop,
            onProgress: async (progress) => {
              await saveProgress({
                stage: "checking_recovered",
                message: `Verificando recovered: ${progress.checked}/${progress.candidates}`,
                totalRecoveryCandidates: progress.candidates,
                totalRecoveryChecked: progress.checked,
                totalRecovered: progress.recovered,
                totalRecoveryUnknown: progress.unknown,
              });
            },
          }
        );

        if (recoveredResult.stillOfflineVehicles.length > 0 && !shouldStop()) {
          console.log(
            `[PollOrchestrator] Enviando poll para ` +
              `${recoveredResult.stillOfflineVehicles.length} pending confirmados como offline...`
          );

          await saveProgress(
            {
              stage: "polling_recovered_candidates",
              message: `Poll em ${recoveredResult.stillOfflineVehicles.length} candidatos ainda offline`,
            },
            true
          );

          const extraResult = await queue.process(recoveredResult.stillOfflineVehicles, {
            shouldStop,
            onProgress: async (progress) => {
              await saveProgress({
                totalPolled: totalPolled + progress.polled,
                totalSkipped: totalSkipped + progress.skipped,
                totalIgnored: totalIgnored + progress.ignored,
                totalNewMaintenance: totalNewMaintenance + progress.newMaintenance,
                totalErrors: totalErrors + progress.errors,
              });
            },
          });

          totalPolled += extraResult.polled;
          totalSkipped += extraResult.skipped;
          totalIgnored += extraResult.ignored;
          totalNewMaintenance += extraResult.newMaintenance;
          totalErrors += extraResult.errors;
        }

        execution.totalRecovered = recoveredResult.totalRecovered;
        execution.totalRecoveryUnknown = recoveredResult.totalUnknown;
      }

      execution.finishedAt = new Date();
      execution.status = shouldStop() ? "stopped" : "completed";
      execution.stage = shouldStop() ? "stopped" : "completed";
      execution.message = shouldStop()
        ? "Execucao parada por solicitacao manual"
        : "Execucao concluida";
      execution.stopRequested = shouldStop();
      execution.totalScanned = scanStats.totalScanned;
      execution.totalActive = scanStats.totalActive;
      execution.totalDeactivated = scanStats.totalDeactivated;
      execution.totalPolled = totalPolled;
      execution.totalSkipped = totalSkipped;
      execution.totalIgnored = totalIgnored;
      execution.totalNewMaintenance = totalNewMaintenance;
      execution.totalErrors = totalErrors;
      execution.tokenRefreshCount = tokenManager.getStats().refreshCount;
      execution.pagesProcessed = scanStats.pagesProcessed;
      await execution.save();

      const duration = ((execution.finishedAt - execution.startedAt) / 1000 / 60).toFixed(1);
      console.log(`[PollOrchestrator] Execucao ${execution.status} em ${duration} min`);

      return execution.toObject();
    } catch (err) {
      console.error("[PollOrchestrator] Erro fatal:", err.message);

      execution.finishedAt = new Date();
      execution.status = shouldStop() ? "stopped" : "failed";
      execution.stage = execution.status;
      execution.message = shouldStop()
        ? "Execucao parada por solicitacao manual"
        : "Execucao falhou";
      execution.stopRequested = shouldStop();
      execution.error = err.message;
      await execution.save();

      return execution.toObject();
    } finally {
      isRunning = false;
      stopRequested = false;
      currentExecutionId = null;
    }
  }

  static async #checkRecovered(PollHistory, scanner, offlineVehicleIds, options = {}) {
    const { shouldStop = () => false, onProgress = null } = options;
    const cutoff = new Date(Date.now() - RECOVERED_WINDOW_MS);

    let candidates = 0;
    let checked = 0;
    let totalRecovered = 0;
    let totalUnknown = 0;
    const stillOfflineVehicles = [];

    const emitProgress = async () => {
      if (onProgress) {
        await onProgress({
          candidates,
          checked,
          recovered: totalRecovered,
          unknown: totalUnknown,
        });
      }
    };

    const processBatch = async (batch) => {
      await mapLimit(batch, RECOVERY_CHECK_CONCURRENCY, async (ph) => {
        if (shouldStop()) return;

        const timestamp = await scanner.fetchVehicleTimestamp(ph.vehicleId);
        checked++;

        if (!timestamp) {
          totalUnknown++;
          console.warn(
            `[PollOrchestrator] Sem timestamp para ${ph.vin || ph.vehicleId}; mantendo pending sem poll extra`
          );
          await emitProgress();
          return;
        }

        const lastEvent = new Date(timestamp);

        if (lastEvent > cutoff) {
          await PollHistory.updateOne(
            { _id: ph._id },
            {
              status: "recovered",
              recoveredAt: lastEvent,
              totalAttempts: 0,
              attempts: [],
            }
          );
          totalRecovered++;

          console.log(
            `[PollOrchestrator] RECUPERADO: ${ph.vin || ph.vehicleId} ` +
              `(ultimo evento: ${lastEvent.toISOString()})`
          );
        } else {
          stillOfflineVehicles.push({
            id: ph.vehicleId,
            vin: ph.vin,
            description: ph.description,
          });
        }

        await emitProgress();
      });
    };

    console.log("[PollOrchestrator] Verificando candidatos a recovered via API...");

    let batch = [];
    const cursor = PollHistory.find({ status: "pending" })
      .select("vehicleId vin description")
      .lean()
      .cursor();

    for await (const ph of cursor) {
      if (shouldStop()) break;
      if (offlineVehicleIds.has(ph.vehicleId)) continue;

      candidates++;
      batch.push(ph);

      if (batch.length >= RECOVERY_BATCH_SIZE) {
        await processBatch(batch);
        batch = [];
      }
    }

    if (batch.length > 0 && !shouldStop()) {
      await processBatch(batch);
    }

    console.log(
      `[PollOrchestrator] Verificacao concluida: ` +
        `${totalRecovered} recovered, ${stillOfflineVehicles.length} ainda offline, ` +
        `${totalUnknown} sem confirmacao`
    );

    await emitProgress();
    return { totalRecovered, totalUnknown, stillOfflineVehicles };
  }

  static isRunning() {
    return isRunning;
  }

  static getRuntimeStatus() {
    return {
      isRunning,
      stopRequested,
      currentExecutionId,
    };
  }

  static async stop() {
    if (!isRunning) {
      return { stopped: false, message: "Nenhuma execucao em andamento" };
    }

    stopRequested = true;

    if (currentExecutionId) {
      const PollExecution = await getPollExecutionModel();
      await PollExecution.updateOne(
        { _id: currentExecutionId },
        {
          status: "stopping",
          stage: "stopping",
          message: "Parada solicitada; aguardando etapa atual finalizar",
          stopRequested: true,
        }
      );
    }

    return {
      stopped: true,
      message: "Parada solicitada; a execucao vai encerrar no proximo ponto seguro",
    };
  }

  static async revalidateMaintenance(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 2000);
    const dryRun = options.dryRun === true || options.dryRun === "true";
    const PollHistory = await getPollHistoryModel();
    const tokenManager = new TokenManager(CREDENTIALS);
    const queue = new PollQueue({ tokenManager });

    const histories = await PollHistory.find({ status: "maintenance" })
      .sort({ lastMaintenanceRevalidatedAt: 1, flaggedAt: -1 })
      .limit(limit);

    let checked = 0;
    let ignored = 0;
    let stillMaintenance = 0;
    let notFoundOrError = 0;
    const sampleIgnored = [];

    await mapLimit(histories, RECOVERY_CHECK_CONCURRENCY, async (history) => {
      const currentVehicle = await queue.fetchCurrentVehicle(history.vehicleId);
      checked++;

      if (!currentVehicle) {
        notFoundOrError++;
        history.lastMaintenanceRevalidatedAt = new Date();
        if (!dryRun) await history.save();
        return;
      }

      const currentDescription = currentVehicle.description || history.description;
      const currentVin = currentVehicle.vin || history.vin;

      if (isVehicleDeactivated(currentVehicle)) {
        ignored++;
        if (sampleIgnored.length < 20) {
          sampleIgnored.push({
            vehicleId: history.vehicleId,
            vin: currentVin,
            previousDescription: history.description,
            currentDescription,
          });
        }

        if (!dryRun) {
          history.status = "ignored";
          history.vin = currentVin;
          history.description = currentDescription;
          history.ignoredAt = new Date();
          history.ignoredReason = "Veiculo desativado/removido na revalidacao de manutencao";
          history.lastMaintenanceRevalidatedAt = new Date();
          await history.save();
        }
        return;
      }

      stillMaintenance++;
      history.vin = currentVin;
      history.description = currentDescription;
      history.lastMaintenanceRevalidatedAt = new Date();
      if (!dryRun) await history.save();
    });

    return {
      dryRun,
      limit,
      checked,
      ignored,
      stillMaintenance,
      notFoundOrError,
      sampleIgnored,
    };
  }
}

export default PollOrchestrator;
