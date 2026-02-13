import ExcelJS from "exceljs";
import getScheduleModel from "../models/Schedule.js";
import getServiceModel from "../models/Service.js";
import getServiceLegacyModel from "../models/ServiceLegacy.js";

// ─── Constantes ──────────────────────────────────────────

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
const LEGACY_ROW_COLOR = "FFFFF3CD";

// ─── Helpers ─────────────────────────────────────────────

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

function styleHeaderRow(row, color) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
  row.alignment = { horizontal: "center" };
}

function highlightRow(row, color) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    };
  });
}

// ─── Definição de colunas ────────────────────────────────

function getServiceColumns(includeOldData) {
  const columns = [
    { header: "Chassi", key: "vin", width: 22 },
    { header: "Placa", key: "plate", width: 12 },
    { header: "Modelo", key: "model", width: 18 },
    { header: "Cliente", key: "client", width: 24 },
    { header: "Equipamento", key: "product", width: 22 },
    { header: "Tipo de Serviço", key: "serviceType", width: 16 },
    { header: "ID Dispositivo", key: "deviceId", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Técnico", key: "technician", width: 20 },
    { header: "Prestador", key: "provider", width: 20 },
    { header: "Local de Instalação", key: "installationLocation", width: 24 },
    { header: "Endereço", key: "serviceAddress", width: 28 },
    { header: "Odômetro (km)", key: "odometer", width: 14 },
    { header: "Bloqueio", key: "blocking", width: 10 },
    { header: "Nº Protocolo", key: "protocolNumber", width: 16 },
    { header: "Dispositivo Secundário", key: "secondaryDevice", width: 20 },
    { header: "Validado por", key: "validatedBy", width: 18 },
    { header: "Data de Validação", key: "validatedAt", width: 18 },
    { header: "Criado por", key: "createdBy", width: 18 },
    { header: "Data de Criação", key: "createdAt", width: 18 },
  ];

  if (includeOldData) {
    columns.push({ header: "Origem", key: "source", width: 16 });
  }

  return columns;
}

function getScheduleColumns() {
  return [
    { header: "Chassi", key: "vin", width: 22 },
    { header: "Placa", key: "plate", width: 12 },
    { header: "Modelo", key: "model", width: 18 },
    { header: "Cliente", key: "client", width: 24 },
    { header: "Equipamento", key: "product", width: 22 },
    { header: "Tipo de Serviço", key: "serviceType", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Prestador", key: "provider", width: 20 },
    { header: "Data Agendada", key: "scheduledDate", width: 16 },
    { header: "Criado por", key: "createdBy", width: 18 },
    { header: "Data de Criação", key: "createdAt", width: 18 },
  ];
}

// ─── Transformadores de linha ────────────────────────────

function serviceToRow(s, source = "current") {
  return {
    vin: s.vin || "",
    plate: s.plate || "",
    model: s.model || "",
    client: source === "legacy" ? (s.client || "") : (s.client?.name || ""),
    product: source === "legacy" ? (s.product || "") : (s.product?.name || ""),
    serviceType: SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
    deviceId: s.deviceId || "",
    status: s.status || "",
    technician: s.technician || "",
    provider: s.provider || "",
    installationLocation: s.installationLocation || "",
    serviceAddress: s.serviceAddress || "",
    odometer: s.odometer ?? "",
    blocking: s.blockingEnabled ? "Sim" : "Não",
    protocolNumber: s.protocolNumber || "",
    secondaryDevice: s.secondaryDevice || "",
    validatedBy: s.validatedBy || "",
    validatedAt: formatDate(s.validatedAt),
    createdBy: s.createdBy || "",
    createdAt: formatDate(s.createdAt),
    source: source === "legacy" ? "Legado" : "Atual",
  };
}

function scheduleToRow(s) {
  return {
    vin: s.vin || "",
    plate: s.plate || "",
    model: s.model || "",
    client: s.client?.name || "",
    product: s.product?.name || "",
    serviceType: SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
    status: STATUS_MAP[s.status] || s.status || "",
    provider: s.provider || "",
    scheduledDate: formatDate(s.scheduledDate),
    createdBy: s.createdBy || "",
    createdAt: formatDate(s.createdAt),
  };
}

// ─── Streaming por batches (cursor) ─────────────────────

const BATCH_SIZE = 500;

/**
 * Processa um cursor do Mongoose em batches,
 * escrevendo cada linha na sheet sem acumular em memória
 */
async function streamCursorToSheet(cursor, sheet, rowTransformer, options = {}) {
  const { isLegacy = false, includeOldData = false } = options;
  let count = 0;

  for await (const doc of cursor) {
    const rowData = rowTransformer(doc, isLegacy ? "legacy" : "current");
    const row = sheet.addRow(rowData);

    // Destaca linhas legadas
    if (includeOldData && isLegacy) {
      highlightRow(row, LEGACY_ROW_COLOR);
    }

    count++;

    // A cada batch, força o garbage collector a respirar
    if (count % BATCH_SIZE === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return count;
}

// ─── Export principal (streaming) ────────────────────────

/**
 * Gera o Excel em streaming direto no response
 *
 * @param {Object} params
 * @param {string} params.type
 * @param {boolean} params.includeOldData
 * @param {string|null} params.dateFrom
 * @param {string|null} params.dateTo
 * @param {Response} res - Express response (stream de saída)
 */
export async function streamExcelExport(
  { type, includeOldData = false, dateFrom = null, dateTo = null },
  res
) {
  // Cria workbook em modo streaming
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
    useSharedStrings: false, // mais leve em memória
  });

  workbook.creator = "Sistema";
  workbook.created = new Date();

  if (type === "services") {
    await streamServices(workbook, { includeOldData, dateFrom, dateTo });
  } else {
    await streamSchedules(workbook, { dateFrom, dateTo });
  }

  await workbook.commit();
}

async function streamServices(workbook, { includeOldData, dateFrom, dateTo }) {
  const sheet = workbook.addWorksheet("Serviços");
  const columns = getServiceColumns(includeOldData);
  sheet.columns = columns;

  // Estiliza header
  const headerRow = sheet.getRow(1);
  styleHeaderRow(headerRow, HEADER_COLOR_SERVICES);
  headerRow.commit();

  // 1) Stream dos dados atuais
  const Service = await getServiceModel();
  const dateFilter = buildDateRange(dateFrom, dateTo, "createdAt");

  const currentCursor = Service.find(dateFilter)
    .populate("client", "name")
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  const currentCount = await streamCursorToSheet(
    currentCursor,
    sheet,
    serviceToRow,
    { isLegacy: false, includeOldData }
  );

  console.log(`✅ Serviços atuais escritos: ${currentCount}`);

  // 2) Stream dos dados legados (se solicitado)
  if (includeOldData) {
    const ServiceLegacy = await getServiceLegacyModel();
    const legacyDateFilter = buildDateRange(dateFrom, dateTo, "validatedAt");

    const legacyCursor = ServiceLegacy.find(legacyDateFilter)
      .sort({ validatedAt: -1 })
      .lean()
      .cursor({ batchSize: BATCH_SIZE });

    const legacyCount = await streamCursorToSheet(
      legacyCursor,
      sheet,
      serviceToRow,
      { isLegacy: true, includeOldData }
    );

    console.log(`✅ Serviços legados escritos: ${legacyCount}`);

    // Legenda no final
    addLegendToStream(sheet);
  }

  sheet.commit();
}

async function streamSchedules(workbook, { dateFrom, dateTo }) {
  const sheet = workbook.addWorksheet("Agendamentos");
  sheet.columns = getScheduleColumns();

  const headerRow = sheet.getRow(1);
  styleHeaderRow(headerRow, HEADER_COLOR_SCHEDULES);
  headerRow.commit();

  const Schedule = await getScheduleModel();
  const dateFilter = buildDateRange(dateFrom, dateTo, "createdAt");

  const cursor = Schedule.find(dateFilter)
    .populate("client", "name")
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  const count = await streamCursorToSheet(cursor, sheet, scheduleToRow);
  console.log(`✅ Agendamentos escritos: ${count}`);

  sheet.commit();
}

function addLegendToStream(sheet) {
  // Linha vazia
  const emptyRow = sheet.addRow({});
  emptyRow.commit();

  const legendTitle = sheet.addRow({ vin: "LEGENDA:" });
  legendTitle.getCell(1).font = { bold: true };
  legendTitle.commit();

  const currentRow = sheet.addRow({ vin: "⬜", plate: "Dados atuais" });
  currentRow.commit();

  const legacyRow = sheet.addRow({
    vin: "🟨",
    plate: "Dados legados (importação anterior)",
  });
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
  legacyRow.commit();
}