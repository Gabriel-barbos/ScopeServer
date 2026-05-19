import fetch from "node-fetch";
import getPollHistoryModel from "../models/PollHistory.js";
import { isVehicleDeactivated } from "./PollScanner.js";

const API_URL = "https://live.mzoneweb.net/mzone62.api";
const DELAY_MS = 500;
const MAX_ATTEMPTS = 3;

class PollQueue {
  constructor({ tokenManager }) {
    this.tokenManager = tokenManager;
  }

  /**
   * Envia _.poll para um unico veiculo.
   * @returns {{ success: boolean, httpStatus: number, error?: string }}
   */
  async sendPoll(vehicleId) {
    const token = await this.tokenManager.getToken();

    try {
      const res = await fetch(`${API_URL}/Vehicles(${vehicleId})/_.poll`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

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

  async fetchCurrentVehicle(vehicleId) {
    const token = await this.tokenManager.getToken();

    try {
      const res = await fetch(
        `${API_URL}/Vehicles(${vehicleId})?$select=id,description,vin,unit_Description,lastKnownEventUtcTimestamp`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        console.warn(
          `[PollQueue] Nao foi possivel revalidar ${vehicleId} antes da manutencao: ` +
            `HTTP ${res.status} - ${text}`
        );
        return null;
      }

      return await res.json();
    } catch (err) {
      console.warn(
        `[PollQueue] Falha de rede ao revalidar ${vehicleId} antes da manutencao: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Processa um array de veiculos:
   * - Busca historicos em lote para evitar 1 query Mongo por veiculo
   * - Envia poll se < 3 tentativas
   * - Marca manutencao se >= 3 tentativas
   *
   * @param {Array} vehicles - Veiculos ativos offline
   * @returns {{ polled, skipped, ignored, newMaintenance, errors }}
   */
  async process(vehicles, options = {}) {
    const { shouldStop = () => false, onProgress = null } = options;
    const PollHistory = await getPollHistoryModel();

    let polled = 0;
    let skipped = 0;
    let ignored = 0;
    let newMaintenance = 0;
    let errors = 0;
    let processed = 0;

    const ids = vehicles.map((vehicle) => vehicle.id);
    const existing = await PollHistory.find({ vehicleId: { $in: ids } });
    const historiesByVehicleId = new Map(
      existing.map((history) => [history.vehicleId, history])
    );

    const emitProgress = async () => {
      if (onProgress) {
        await onProgress({ processed, polled, skipped, ignored, newMaintenance, errors });
      }
    };

    for (const vehicle of vehicles) {
      if (shouldStop()) break;

      try {
        let history = historiesByVehicleId.get(vehicle.id);

        if (!history) {
          history = new PollHistory({
            vehicleId: vehicle.id,
            vin: vehicle.vin,
            description: vehicle.description,
            status: "pending",
          });
          historiesByVehicleId.set(vehicle.id, history);
        }

        history.lastSeenOffline = new Date();

        if (history.status === "maintenance") {
          skipped++;
          await history.save();
          processed++;
          await emitProgress();
          continue;
        }

        if (history.status === "ignored") {
          skipped++;
          processed++;
          await emitProgress();
          continue;
        }

        if (history.totalAttempts >= MAX_ATTEMPTS) {
          const currentVehicle = await this.fetchCurrentVehicle(vehicle.id);

          if (currentVehicle) {
            history.vin = currentVehicle.vin || history.vin || vehicle.vin;
            history.description =
              currentVehicle.description || history.description || vehicle.description;

            if (isVehicleDeactivated(currentVehicle)) {
              history.status = "ignored";
              history.ignoredAt = new Date();
              history.ignoredReason = "Veiculo desativado/removido na revalidacao antes da manutencao";
              await history.save();
              ignored++;
              processed++;
              await emitProgress();

              console.log(
                `[PollQueue] IGNORADO: ${history.vin || vehicle.id} ` +
                  `(status atual: ${history.description || "sem descricao"})`
              );
              continue;
            }
          }

          history.status = "maintenance";
          history.flaggedAt = new Date();
          await history.save();
          newMaintenance++;
          processed++;
          await emitProgress();

          console.log(
            `[PollQueue] MANUTENCAO: ${vehicle.vin || vehicle.id} ` +
              `(${history.totalAttempts} tentativas sem retorno)`
          );
          continue;
        }

        const result = await this.sendPoll(vehicle.id);

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
            `[PollQueue] Erro ao pollar ${vehicle.vin}: ` +
              `HTTP ${result.httpStatus} - ${result.error}`
          );
        }

        processed++;
        await emitProgress();

        await new Promise((r) => setTimeout(r, DELAY_MS));
      } catch (err) {
        errors++;
        processed++;
        await emitProgress();
        console.error(`[PollQueue] Erro inesperado em ${vehicle.id}:`, err.message);
      }
    }

    return { polled, skipped, ignored, newMaintenance, errors };
  }
}

export default PollQueue;
