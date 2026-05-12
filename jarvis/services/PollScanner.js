import fetch from "node-fetch";

const API_URL = "https://live.mzoneweb.net/mzone62.api";
const PAGE_SIZE = 10000;

function isVehicleDeactivated(vehicle) {
  const desc = (vehicle.description || "").toUpperCase().trim();
  const unitDesc = (vehicle.unit_Description || "").trim();

  if (desc.startsWith("REMOVIDO")) return true;
  if (desc.startsWith("CANCELADO")) return true;
  if (desc.startsWith("CANCELAMENTO")) return true;
  if (desc.startsWith("DESATIVADO")) return true;
  if (unitDesc.includes("_")) return true;

  return false;
}

class PollScanner {
  constructor({ tokenManager }) {
    this.tokenManager = tokenManager;
  }

  async fetchPage(cutoffDate, skip = 0) {
    const token = await this.tokenManager.getToken();

    const path =
      `/Vehicles?$filter=lastKnownEventUtcTimestamp lt ${cutoffDate}` +
      `&$select=id,description,vin,unit_Description,lastKnownEventUtcTimestamp` +
      `&$top=${PAGE_SIZE}&$skip=${skip}`;

    const res = await fetch(`${API_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API Error ${res.status} ao buscar veículos: ${text}`);
    }

    const data = await res.json();
    const vehicles = data.value || [];

    return {
      vehicles,
      hasMore: vehicles.length === PAGE_SIZE,
    };
  }

  async scan(onPage) {
    const cutoffDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    let skip = 0;
    let totalScanned = 0;
    let totalActive = 0;
    let totalDeactivated = 0;
    let pagesProcessed = 0;

    console.log(`[PollScanner] Iniciando varredura. Cutoff: ${cutoffDate}`);

    while (true) {
      console.log(`[PollScanner] Buscando página ${pagesProcessed + 1} (skip=${skip})...`);

      const { vehicles, hasMore } = await this.fetchPage(cutoffDate, skip);

      totalScanned += vehicles.length;
      pagesProcessed++;

      const active = [];
      for (const v of vehicles) {
        if (isVehicleDeactivated(v)) {
          totalDeactivated++;
        } else {
          active.push(v);
          totalActive++;
        }
      }

      console.log(
        `[PollScanner] Página ${pagesProcessed}: ` +
        `${vehicles.length} total, ${active.length} ativos, ` +
        `${vehicles.length - active.length} desativados`
      );

      if (active.length > 0 && onPage) {
        await onPage(active, { page: pagesProcessed, totalScanned });
      }

      if (!hasMore) break;
      skip += PAGE_SIZE;
    }

    const stats = { totalScanned, totalActive, totalDeactivated, pagesProcessed };
    console.log(`[PollScanner] Varredura concluída:`, stats);

    return stats;
  }

  /**
   * Busca o lastKnownEventUtcTimestamp de um veículo específico.
   * Usado para verificar se um veículo pending realmente voltou a reportar.
   * 
   * @param {string} vehicleId
   * @returns {string|null} ISO timestamp ou null em caso de erro
   */
  async fetchVehicleTimestamp(vehicleId) {
    const token = await this.tokenManager.getToken();

    try {
      const res = await fetch(
        `${API_URL}/Vehicles(${vehicleId})?$select=id,lastKnownEventUtcTimestamp`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        console.warn(`[PollScanner] Erro ao buscar timestamp de ${vehicleId}: HTTP ${res.status}`);
        return null;
      }

      const data = await res.json();
      return data.lastKnownEventUtcTimestamp || null;
    } catch (err) {
      console.warn(`[PollScanner] Falha de rede ao buscar ${vehicleId}: ${err.message}`);
      return null;
    }
  }
}

export { isVehicleDeactivated };
export default PollScanner;