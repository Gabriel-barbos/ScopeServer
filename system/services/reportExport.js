import ExcelJS from "exceljs";
import getScheduleModel from "../models/Schedule.js";
import getServiceModel from "../models/Service.js";
import getServiceLegacyModel from "../models/ServiceLegacy.js";


const SERVICE_TYPE_MAP = {
  installation: "Instalação",
  maintenance: "Manutenção",
  removal: "Desinstalação",
};

const STATUS_MAP = {
  criado: "Criado",
  agendado: "Agendado",
  concluido: "Concluído",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const HEADER_COLOR_SERVICES = "FF722ED1";
const HEADER_COLOR_SCHEDULES = "FF1890FF";
const LEGACY_ROW_COLOR = "FFFFF3CD"; // amarelo claro para legado


function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

function buildDateRange(dateFrom, dateTo, dateField = "createdAt") {
  if (!dateFrom && !dateTo) return {};
  const filter = {};
  if (dateFrom) filter.$gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    filter.$lte = end;
  }
  return { [dateField]: filter };
}

function styleHeader(sheet, color) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
  row.alignment = { horizontal: "center" };
}

function setColumnWidths(sheet, widths) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

function highlightRow(sheet, rowNumber, color) {
  const row = sheet.getRow(rowNumber);
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    };
  });
}

function addLegend(sheet) {
  // Pula 2 linhas após os dados
  const lastRow = sheet.rowCount + 2;

  const legendRow = sheet.getRow(lastRow);
  legendRow.getCell(1).value = "LEGENDA:";
  legendRow.getCell(1).font = { bold: true };

  const currentRow = sheet.getRow(lastRow + 1);
  currentRow.getCell(1).value = "⬜";
  currentRow.getCell(2).value = "Dados atuais";

  const legacyRow = sheet.getRow(lastRow + 2);
  legacyRow.getCell(1).value = "🟨";
  legacyRow.getCell(2).value = "Dados legados (importação anterior)";
  legacyRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: LEGACY_ROW_COLOR },
  };
  legacyRow.getCell(2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: LEGACY_ROW_COLOR },
  };
}


async function fetchServices(dateFrom, dateTo) {
  const Service = await getServiceModel();
  const dateFilter = buildDateRange(dateFrom, dateTo, "createdAt");

  const services = await Service.find(dateFilter)
    .populate("client", "name")
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .lean();

  return services.map((s) => ({
    ...s,
    _source: "current",
    _clientName: s.client?.name || "",
    _productName: s.product?.name || "",
  }));
}

async function fetchLegacyServices(dateFrom, dateTo) {
  const ServiceLegacy = await getServiceLegacyModel();

  // Legado usa validatedAt como campo de data principal
  // Se não tiver, tenta pelo createdAt ou scheduledDate
  const dateFilter = buildDateRange(dateFrom, dateTo, "validatedAt");

  const legacy = await ServiceLegacy.find(dateFilter)
    .sort({ validatedAt: -1 })
    .lean();

  return legacy.map((s) => ({
    ...s,
    _source: "legacy",
    // Legado tem client/product como string direto
    _clientName: s.client || "",
    _productName: s.product || "",
  }));
}

async function fetchSchedules(dateFrom, dateTo) {
  const Schedule = await getScheduleModel();
  const dateFilter = buildDateRange(dateFrom, dateTo, "createdAt");

  return Schedule.find(dateFilter)
    .populate("client", "name")
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .lean();
}


function buildServicesSheet(workbook, data, includeOldData) {
  const sheet = workbook.addWorksheet("Serviços");

  // Colunas - adicionamos "Origem" quando tem dados legados
  const headers = [
    "Chassi", "Placa", "Modelo", "Cliente", "Equipamento",
    "Tipo de Serviço", "ID Dispositivo", "Status", "Técnico",
    "Prestador", "Local de Instalação", "Endereço", "Odômetro (km)",
    "Bloqueio", "Nº Protocolo", "Dispositivo Secundário",
    "Validado por", "Data de Validação", "Criado por", "Data de Criação",
  ];

  const colWidths = [
    22, 12, 18, 24, 22, 16, 18, 14, 20, 20,
    24, 28, 14, 10, 16, 20, 18, 18, 18, 18,
  ];

  if (includeOldData) {
    headers.push("Origem");
    colWidths.push(16);
  }

  sheet.addRow(headers);
  styleHeader(sheet, HEADER_COLOR_SERVICES);

  data.forEach((s) => {
    const row = [
      s.vin || "",
      s.plate || "",
      s.model || "",
      s._clientName,
      s._productName,
      SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
      s.deviceId || "",
      s.status || "",
      s.technician || "",
      s.provider || "",
      s.installationLocation || "",
      s.serviceAddress || "",
      s.odometer ?? "",
      s.blockingEnabled ? "Sim" : "Não",
      s.protocolNumber || "",
      s.secondaryDevice || "",
      s.validatedBy || "",
      s.validatedAt ? formatDate(s.validatedAt) : "",
      s.createdBy || "",
      s.createdAt ? formatDate(s.createdAt) : "",
    ];

    if (includeOldData) {
      row.push(s._source === "legacy" ? "Legado" : "Atual");
    }

    sheet.addRow(row);

    // Destaca linhas de dados legados
    if (includeOldData && s._source === "legacy") {
      highlightRow(sheet, sheet.rowCount, LEGACY_ROW_COLOR);
    }
  });

  setColumnWidths(sheet, colWidths);

  // Adiciona legenda se tem dados misturados
  if (includeOldData) {
    addLegend(sheet);
  }

  return sheet;
}

function buildSchedulesSheet(workbook, data) {
  const sheet = workbook.addWorksheet("Agendamentos");

  const headers = [
    "Chassi", "Placa", "Modelo", "Cliente", "Equipamento",
    "Tipo de Serviço", "Status", "Prestador", "Data Agendada",
    "Criado por", "Data de Criação",
  ];

  sheet.addRow(headers);
  styleHeader(sheet, HEADER_COLOR_SCHEDULES);

  data.forEach((s) => {
    sheet.addRow([
      s.vin || "",
      s.plate || "",
      s.model || "",
      s.client?.name || "",
      s.product?.name || "",
      SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
      STATUS_MAP[s.status] || s.status || "",
      s.provider || "",
      s.scheduledDate ? formatDate(s.scheduledDate) : "",
      s.createdBy || "",
      s.createdAt ? formatDate(s.createdAt) : "",
    ]);
  });

  setColumnWidths(sheet, [22, 12, 18, 24, 22, 16, 12, 20, 16, 18, 18]);

  return sheet;
}

// ─── Função Principal ────────────────────────────────────

/**
 * Gera o workbook Excel baseado nos parâmetros recebidos
 *
 * @param {Object} params
 * @param {string} params.type - "services" | "schedules"
 * @param {boolean} params.includeOldData - incluir dados legados (só para services)
 * @param {string|null} params.dateFrom - data início (YYYY-MM-DD)
 * @param {string|null} params.dateTo - data fim (YYYY-MM-DD)
 * @returns {ExcelJS.Workbook}
 */
export async function generateExcelExport({ type, includeOldData = false, dateFrom = null, dateTo = null }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema";
  workbook.created = new Date();

  if (type === "services") {
    // Busca dados atuais
    const currentData = await fetchServices(dateFrom, dateTo);

    let allData = currentData;

    // Se includeOldData, busca e mescla os legados
    if (includeOldData) {
      const legacyData = await fetchLegacyServices(dateFrom, dateTo);
      allData = [...currentData, ...legacyData];

      // Ordena tudo junto por data (mais recente primeiro)
      allData.sort((a, b) => {
        const dateA = a.createdAt || a.validatedAt || 0;
        const dateB = b.createdAt || b.validatedAt || 0;
        return new Date(dateB) - new Date(dateA);
      });
    }

    buildServicesSheet(workbook, allData, includeOldData);
  } else {
    // Schedules - nunca tem dados legados
    const schedules = await fetchSchedules(dateFrom, dateTo);
    buildSchedulesSheet(workbook, schedules);
  }

  return workbook;
}