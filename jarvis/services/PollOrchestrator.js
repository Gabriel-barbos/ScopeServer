import TokenManager from "./TokenManager.js";
import PollScanner from "./PollScanner.js";
import PollQueue from "./PollQueue.js";
import getPollHistoryModel from "../models/PollHistory.js";
import getPollExecutionModel from "../models/PollExecution.js";

// Credenciais BR Main
const CREDENTIALS = {
  login: "brazil-support@scopetechnology.com",
  password: "Scope@br2021",
};

// Flag para evitar execuções simultâneas
let isRunning = false;

class PollOrchestrator {
  /**
   * Executa o fluxo completo de poll:
   * 1. Gera token
   * 2. Varre base paginada (só offline 72h+)
   * 3. Filtra desativados
   * 4. Consulta histórico e envia polls
   * 5. Detecta veículos recuperados
   * 6. Registra log de execução
   * 
   * @param {'cron'|'manual'} trigger - Quem disparou a execução
   */
  static async run(trigger = "manual") {
    if (isRunning) {
      console.log("[PollOrchestrator] ⚠️ Já existe uma execução em andamento. Abortando.");
      return { error: "Execução já em andamento" };
    }

    isRunning = true;

    const PollExecution = await getPollExecutionModel();
    const PollHistory = await getPollHistoryModel();

    // Cria log de execução
    const execution = new PollExecution({
      startedAt: new Date(),
      trigger,
      status: "running",
    });
    await execution.save();

    console.log(`[PollOrchestrator] 🚀 Iniciando execução (trigger: ${trigger})`);

    try {
      // 1. Token Manager
      const tokenManager = new TokenManager(CREDENTIALS);

      // 2. Scanner + Queue
      const scanner = new PollScanner({ tokenManager });
      const queue = new PollQueue({ tokenManager });

      // Acumula IDs dos veículos vistos como offline nesta execução
      const offlineVehicleIds = new Set();

      // Totais acumulados
      let totalPolled = 0;
      let totalSkipped = 0;
      let totalNewMaintenance = 0;
      let totalErrors = 0;

      // 3. Varredura paginada — processa cada página inline
      const scanStats = await scanner.scan(async (activeVehicles, pageStats) => {
        // Registra todos os IDs offline desta página
        for (const v of activeVehicles) {
          offlineVehicleIds.add(v.id);
        }

        // Processa a fila de poll para esta página
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

      // 4. Detecção de veículos recuperados
      // Veículos com status 'pending' que NÃO apareceram nesta varredura = voltaram a comunicar
      const pendingVehicles = await PollHistory.find({ status: "pending" });
      let totalRecovered = 0;

      for (const ph of pendingVehicles) {
        if (!offlineVehicleIds.has(ph.vehicleId)) {
          ph.status = "recovered";
          ph.totalAttempts = 0;
          ph.attempts = [];
          await ph.save();
          totalRecovered++;

          console.log(
            `[PollOrchestrator] ✅ RECUPERADO: ${ph.vin || ph.vehicleId}`
          );
        }
      }

      // 5. Atualiza log de execução
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
   * Retorna se uma execução está em andamento.
   */
  static isRunning() {
    return isRunning;
  }
}

export default PollOrchestrator;
