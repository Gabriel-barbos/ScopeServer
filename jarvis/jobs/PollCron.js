import cron from "node-cron";
import PollOrchestrator from "../services/PollOrchestrator.js";

/**
 * Registra o cron job do Auto Poll 72h.
 * Roda às 06:00 de Terças (2) e Sextas (5) no horário de Brasília.
 */
const registerPollCron = () => {
  cron.schedule(
    "0 8 * * 2,5",
    async () => {
      console.log("[PollCron] ⏰ Cron disparado — Iniciando Auto Poll 72h");

      try {
        await PollOrchestrator.run("cron");
      } catch (err) {
        console.error("[PollCron] ❌ Erro no cron:", err.message);
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );

  console.log("[PollCron] ✅ Cron registrado: Ter & Sex às 08:00 (America/Sao_Paulo)");
};

export default registerPollCron;
