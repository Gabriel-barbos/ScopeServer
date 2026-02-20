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

const HEADER_COLOR_SERVICES  = "FF722ED1";
const HEADER_COLOR_SCHEDULES = "FF1890FF";

const BATCH_SIZE = 200;

// ─── Helpers ─────────────────────────────────────────────

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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
  row.font      = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  row.alignment = { horizontal: "center" };
  row.commit();
}

//colunas

function getServiceColumns(includeOldData) {
  const cols = [
    { header: "Chassi",                  key: "vin",                  width: 22 },
    { header: "Placa",                   key: "plate",                width: 12 },
    { header: "Modelo",                  key: "model",                width: 18 },
    { header: "Cliente",                 key: "client",               width: 24 },
    { header: "Equipamento",             key: "product",              width: 22 },
    { header: "Tipo de Serviço",         key: "serviceType",          width: 16 },
    { header: "ID Dispositivo",          key: "deviceId",             width: 18 },
    { header: "Status",                  key: "status",               width: 14 },
    { header: "Técnico",                 key: "technician",           width: 20 },
    { header: "Prestador",               key: "provider",             width: 20 },
    { header: "Local de Instalação",     key: "installationLocation", width: 24 },
    { header: "Endereço",                key: "serviceAddress",       width: 28 },
    { header: "Odômetro (km)",           key: "odometer",             width: 14 },
    { header: "Bloqueio",                key: "blocking",             width: 10 },
    { header: "Nº Protocolo",            key: "protocolNumber",       width: 16 },
    { header: "Dispositivo Secundário",  key: "secondaryDevice",      width: 20 },
    { header: "Validado por",            key: "validatedBy",          width: 18 },
    { header: "Data de Validação",       key: "validatedAt",          width: 18 },
    { header: "Criado por",              key: "createdBy",            width: 18 },
    { header: "Data de Criação",         key: "createdAt",            width: 18 },
  ];

  if (includeOldData) cols.push({ header: "Origem", key: "source", width: 16 });

  return cols;
}

function getScheduleColumns() {
  return [
    { header: "Chassi",          key: "vin",           width: 22 },
    { header: "Placa",           key: "plate",         width: 12 },
    { header: "Modelo",          key: "model",         width: 18 },
    { header: "Cliente",         key: "client",        width: 24 },
    { header: "Equipamento",     key: "product",       width: 22 },
    { header: "Tipo de Serviço", key: "serviceType",   width: 16 },
    { header: "Status",          key: "status",        width: 12 },
    { header: "Prestador",       key: "provider",      width: 20 },
    { header: "Data Agendada",   key: "scheduledDate", width: 16 },
    { header: "Criado por",      key: "createdBy",     width: 18 },
    { header: "Data de Criação", key: "createdAt",     width: 18 },
  ];
}

// ─── Row transformers ────────────────────────────────────

function serviceToRow(s, source = "current") {
  return {
    vin:                  s.vin                 || "",
    plate:                s.plate               || "",
    model:                s.model               || "",
    client:               source === "legacy" ? (s.client  || "") : (s.client?.name  || ""),
    product:              source === "legacy" ? (s.product || "") : (s.product?.name || ""),
    serviceType:          SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
    deviceId:             s.deviceId            || "",
    status:               s.status              || "",
    technician:           s.technician          || "",
    provider:             s.provider            || "",
    installationLocation: s.installationLocation || "",
    serviceAddress:       s.serviceAddress      || "",
    odometer:             s.odometer            ?? "",
    blocking:             s.blockingEnabled ? "Sim" : "Não",
    protocolNumber:       s.protocolNumber      || "",
    secondaryDevice:      s.secondaryDevice     || "",
    validatedBy:          s.validatedBy         || "",
    validatedAt:          formatDate(s.validatedAt),
    createdBy:            s.createdBy           || "",
    createdAt:            formatDate(s.createdAt),
    source:               source === "legacy" ? "Legado" : "Atual",
  };
}

function scheduleToRow(s) {
  return {
    vin:           s.vin                || "",
    plate:         s.plate              || "",
    model:         s.model              || "",
    client:        s.client?.name       || "",
    product:       s.product?.name      || "",
    serviceType:   SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
    status:        STATUS_MAP[s.status] || s.status || "",
    provider:      s.provider           || "",
    scheduledDate: formatDate(s.scheduledDate),
    createdBy:     s.createdBy          || "",
    createdAt:     formatDate(s.createdAt),
  };
}

// ─── Cursor streaming ────────────────────────────────────

async function streamCursorToSheet(cursor, sheet, rowTransformer, isLegacy = false) {
  let count = 0;

  for await (const doc of cursor) {
    const row = sheet.addRow(rowTransformer(doc, isLegacy ? "legacy" : "current"));
    row.commit(); // libera da memória imediatamente

    if (++count % BATCH_SIZE === 0) {
      await new Promise((r) => setImmediate(r));
    }
  }

  return count;
}

// ─── Export principal ────────────────────────────────────

export async function streamExcelExport({ type, includeOldData = false, dateFrom = null, dateTo = null }, res) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
    useSharedStrings: false,
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
  sheet.columns = getServiceColumns(includeOldData);
  styleHeaderRow(sheet.getRow(1), HEADER_COLOR_SERVICES);

  const Service    = await getServiceModel();
  const dateFilter = buildDateRange(dateFrom, dateTo, "createdAt");

  const currentCursor = Service.find(dateFilter)
    .populate("client", "name")
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  const currentCount = await streamCursorToSheet(currentCursor, sheet, serviceToRow, false);
  console.log(`✅ Serviços atuais: ${currentCount}`);

  if (includeOldData) {
    const ServiceLegacy     = await getServiceLegacyModel();
    const legacyDateFilter  = buildDateRange(dateFrom, dateTo, "validatedAt");

    const legacyCursor = ServiceLegacy.find(legacyDateFilter)
      .sort({ validatedAt: -1 })
      .lean()
      .cursor({ batchSize: BATCH_SIZE });

    const legacyCount = await streamCursorToSheet(legacyCursor, sheet, serviceToRow, true);
    console.log(`✅ Serviços legados: ${legacyCount}`);
  }

  sheet.commit();
}

async function streamSchedules(workbook, { dateFrom, dateTo }) {
  const sheet = workbook.addWorksheet("Agendamentos");
  sheet.columns = getScheduleColumns();
  styleHeaderRow(sheet.getRow(1), HEADER_COLOR_SCHEDULES);

  const Schedule   = await getScheduleModel();
  const dateFilter = buildDateRange(dateFrom, dateTo, "createdAt");

  const cursor = Schedule.find(dateFilter)
    .populate("client", "name")
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  const count = await streamCursorToSheet(cursor, sheet, scheduleToRow);
  console.log(`✅ Agendamentos: ${count}`);

  sheet.commit();
}