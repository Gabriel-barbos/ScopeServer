import fetch from "node-fetch";

const API_URL = "https://live.mzoneweb.net/mzone62.api";
const PAGE_SIZE = 10000;

/**
 * Verifica se um veículo está desativado.
 * - description começa com REMOVIDO, CANCELADO V, ou DESATIVADO
 * - unit_Description contém _ (unidade desassociada)
 */
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

/**
 * Varre a base de veículos usando $filter OData para buscar
 * SOMENTE veículos que não comunicam há mais de 72h.
 * Retorna veículos ativos (não desativados) paginados.
 */
class PollScanner {
  constructor({ tokenManager }) {
    this.tokenManager = tokenManager;
  }

  /**
   * Busca uma página de veículos offline.
   * @param {string} cutoffDate 
   * @param {number} skip - Número de registros para pular
   * @returns {{ vehicles: Array, hasMore: boolean }}
   */
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

  /**
   * Varre todas as páginas e retorna apenas veículos ATIVOS offline 72h+.
   * Processa página a página para economia de memória.
   * 
   * @param {Function} onPage - Callback chamado a cada página com os veículos ativos filtrados.
   *                            Assinatura: async (activeVehicles, pageStats) => void
   * @returns {{ totalScanned, totalActive, totalDeactivated, pagesProcessed }}
   */
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

      // Filtra desativados
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

      // Chama callback com veículos ativos desta página
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
}

export { isVehicleDeactivated };
export default PollScanner;
