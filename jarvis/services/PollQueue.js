import fetch from "node-fetch";
import getPollHistoryModel from "../models/PollHistory.js";

const API_URL = "https://live.mzoneweb.net/mzone62.api";
const DELAY_MS = 500; 
const MAX_ATTEMPTS = 3; 

class PollQueue {
  constructor({ tokenManager }) {
    this.tokenManager = tokenManager;
  }

  /**
   * Envia _.poll para um único veículo.
   * @returns {{ success: boolean, httpStatus: number, error?: string }}
   */
  async sendPoll(vehicleId) {
    const token = await this.tokenManager.getToken();

    try {
      const res = await fetch(
        `${API_URL}/Vehicles(${vehicleId})/_.poll`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        success: res.ok,
        httpStatus: res.status,
        error: res.ok ? null : await res.text(),
      };
    } catch (err) {
      return {
        success: false,
        httpStatus: 0,
        error: err.message,
      };
    }
  }

  /**
   * Processa um array de veículos:
   * - Consulta histórico no MongoDB
   * - Envia poll se < 3 tentativas
   * - Marca manutenção se >= 3 tentativas
   * 
   * @param {Array} vehicles - Veículos ativos offline
   * @returns {{ polled, skipped, newMaintenance, errors }}
   */
  async process(vehicles) {
    const PollHistory = await getPollHistoryModel();

    let polled = 0;
    let skipped = 0;
    let newMaintenance = 0;
    let errors = 0;

    for (const vehicle of vehicles) {
      try {
        // Busca ou cria histórico deste veículo
        let history = await PollHistory.findOne({ vehicleId: vehicle.id });

        if (!history) {
          history = new PollHistory({
            vehicleId: vehicle.id,
            vin: vehicle.vin,
            description: vehicle.description,
            status: "pending",
          });
        }

        // Atualiza última vez visto offline
        history.lastSeenOffline = new Date();

        // Se já está em manutenção, pula
        if (history.status === "maintenance") {
          skipped++;
          await history.save();
          continue;
        }

        // Se já tem 3 tentativas, marca como manutenção (na 4ª vez)
        if (history.totalAttempts >= MAX_ATTEMPTS) {
          history.status = "maintenance";
          history.flaggedAt = new Date();
          await history.save();
          newMaintenance++;

          console.log(
            `[PollQueue] 🔧 MANUTENÇÃO: ${vehicle.vin || vehicle.id} ` +
            `(${history.totalAttempts} tentativas sem retorno)`
          );
          continue;
        }

        // Envia o poll
        const result = await this.sendPoll(vehicle.id);

        // Registra a tentativa
        history.attempts.push({
          date: new Date(),
          success: result.success,
          httpStatus: result.httpStatus,
          error: result.error,
        });
        history.totalAttempts += 1;
        history.lastPollDate = new Date();
        history.vin = vehicle.vin;
        history.description = vehicle.description;

        await history.save();

        if (result.success) {
          polled++;
        } else {
          errors++;
          console.log(
            `[PollQueue] ❌ Erro ao pollar ${vehicle.vin}: ` +
            `HTTP ${result.httpStatus} - ${result.error}`
          );
        }

        // Delay entre polls
        await new Promise((r) => setTimeout(r, DELAY_MS));
      } catch (err) {
        errors++;
        console.error(`[PollQueue] Erro inesperado em ${vehicle.id}:`, err.message);
      }
    }

    return { polled, skipped, newMaintenance, errors };
  }
}

export default PollQueue;
