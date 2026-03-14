import ExcelJS from "exceljs";
import getScheduleModel from "../models/Schedule.js";
import getServiceModel from "../models/Service.js";
import getServiceLegacyModel from "../models/ServiceLegacy.js";


const SERVICE_TYPE_MAP = {
  installation: "Instalação",
  maintenance:  "Manutenção",
  removal:      "Desinstalação",
};

const STATUS_MAP = {
  criado:    "Criado",
  agendado:  "Agendado",
  concluido: "Concluído",
  atrasado:  "Atrasado",
  cancelado: "Cancelado",
};

const REASON_MAP = {
  dispositivo_sem_comunicacao: "Dispositivo sem comunicação",
  dispositivo_sem_registro_de_viagem: "Dispositivo sem registro de viagem",
  dispositivo_sem_dados_CAN: "Dispositivo sem dados CAN",
  instalacao_sem_pos_chave: "Instalação sem pos chave",
  instalacao_inadequada: "Instalação inadequada",
  problema_acessorio: "Problema acessório",
  problema_bateria: "Problema bateria",
  substituicao_tecnologia: "Substituição tecnologia",
  upgrade_produto: "Upgrade produto",
  recall_dispositivo: "Recall dispositivo",
  recall_chicote: "Recall chicote",
  outros: "Outros",

};

const HEADER_COLOR_SERVICES  = "FF722ED1";
const HEADER_COLOR_SCHEDULES = "FF1890FF";
const LEGACY_ROW_COLOR       = "FFFFF3CD";
const BATCH_SIZE             = 500;


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
}

function highlightRow(row, color) {
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  });
}

function resolveClientNames(clientDoc) {
  if (!clientDoc) return { clientName: "", subClientName: "" };
  if (clientDoc.parent) {
    return {
      clientName:    clientDoc.parent?.name || "",
      subClientName: clientDoc.name || "",
    };
  }
  return { clientName: clientDoc.name || "", subClientName: "" };
}


function getServiceColumns(includeOldData) {
  const columns = [
    { header: "Placa",                  key: "plate",                width: 12 },
    { header: "Chassi",                 key: "vin",                  width: 22 },
    { header: "ID Dispositivo",         key: "deviceId",             width: 18 },
    { header: "Equipamento",            key: "product",              width: 22 },
    { header: "Tipo de Serviço",        key: "serviceType",          width: 16 },
    { header: "Status",                 key: "status",               width: 14 },
    { header: "Data da Solicitação",    key: "orderDate",            width: 18 },
    { header: "Data de Instalação",     key: "validatedAt",          width: 18 },
    { header: "Cliente",                key: "client",               width: 24 },
    { header: "Sub-cliente",            key: "subClient",            width: 24 },
    { header: "Dispositivo Secundário", key: "secondaryDevice",      width: 20 },
    { header: "Modelo",                 key: "model",                width: 18 },
    { header: "Odômetro (km)",          key: "odometer",             width: 14 },
    { header: "Técnico",                key: "technician",           width: 20 },   
    { header: "Prestador",              key: "provider",             width: 20 },
    { header: "Endereço do Serviço",    key: "serviceAddress",       width: 30 },
    { header: "Local de Instalação",    key: "installationLocation", width: 24 },
    { header: "Bloqueio",               key: "blocking",             width: 10 },
    { header: "Nº Protocolo",           key: "protocolNumber",       width: 16 },
    { header: "Validado por",           key: "validatedBy",          width: 18 },
    { header: "Criado por",             key: "createdBy",            width: 18 },
    { header: "Data de Criação",        key: "createdAt",            width: 18 },
    { header: "Observações",            key: "notes",                width: 18 },
    { header: "Notas de Validação",     key: "validationNotes",      width: 18 },
    { header: "Motivo",                 key: "reason",               width: 18 },

  ];

  if (includeOldData) {
    columns.push({ header: "Origem", key: "source", width: 16 });
  }

  return columns;
}

function getScheduleColumns() {
  return [
    { header: "Cliente",             key: "client",           width: 24 },
    { header: "Sub-cliente",         key: "subClient",        width: 24 },
    { header: "Chassi",              key: "vin",              width: 22 },
    { header: "Placa",               key: "plate",            width: 12 },
    { header: "Modelo",              key: "model",            width: 18 },
    { header: "Equipamento",         key: "product",          width: 22 },
    { header: "Tipo de Serviço",     key: "serviceType",      width: 16 },
    { header: "Status",              key: "status",           width: 12 },
    { header: "Prestador",           key: "provider",         width: 20 },
    { header: "Responsável",         key: "responsible",      width: 20 },
    { header: "Tel. Responsável",    key: "responsiblePhone", width: 18 },
    { header: "Condutor",            key: "condutor",         width: 20 },
    { header: "Endereço do Serviço", key: "serviceAddress",   width: 30 },
    { header: "Local do Serviço",    key: "serviceLocation",  width: 24 },
    { header: "Nº Pedido",           key: "orderNumber",      width: 16 },
    { header: "Data Agendada",       key: "scheduledDate",    width: 16 },
    { header: "Criado por",          key: "createdBy",        width: 18 },
    { header: "Data de Criação",     key: "createdAt",        width: 18 },
    { header: "Data do Pedido",      key: "orderDate",        width: 18 },
    { header: "Motivo",              key: "reason",           width: 18 },
  ];
}


function serviceToRow(s, source = "current") {
  let clientName = "";
  let subClientName = "";

  if (source === "legacy") {
    clientName = s.client || "";
  } else {
    ({ clientName, subClientName } = resolveClientNames(s.client));
  }

  return {
    client:               clientName,
    subClient:            subClientName,
    vin:                  s.vin                  || "",
    plate:                s.plate                || "",
    model:                s.model                || "",
    product:              source === "legacy" ? (s.product || "") : (s.product?.name || ""),
    serviceType:          SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
    status:               s.status               || "",
    deviceId:             s.deviceId             || "",
    secondaryDevice:      s.secondaryDevice      || "",
    technician:           s.technician           || "",
    provider:             s.provider             || "",
    serviceAddress:       s.serviceAddress       || "",
    installationLocation: s.installationLocation || "",
    odometer:             s.odometer ?? "",
    blocking:             s.blockingEnabled ? "Sim" : "Não",
    protocolNumber:       s.protocolNumber       || "",
    validatedBy:          s.validatedBy          || "",
    validatedAt:          formatDate(s.validatedAt),
    createdBy:            s.createdBy            || "",
    createdAt:            formatDate(s.createdAt),
    orderDate:            formatDate(s.orderDate),
    source:               source === "legacy" ? "Legado" : "Atual",
    notes:              s.notes                || "",
    validationNotes:     s.validationNotes      || "",
    orderDate:           formatDate(s.orderDate),
    reason:              REASON_MAP[s.reason] || s.reason || "", 
  };
}

function scheduleToRow(s) {
  const { clientName, subClientName } = resolveClientNames(s.client);

  return {
    client:          clientName,
    subClient:       subClientName,
    vin:             s.vin             || "",
    plate:           s.plate           || "",
    model:           s.model           || "",
    product:         s.product?.name   || "",
    serviceType:     SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
    status:          STATUS_MAP[s.status] || s.status || "",
    provider:        s.provider        || "",
    responsible:     s.responsible     || "",
    responsiblePhone: s.responsiblePhone || "",
    condutor:        s.condutor        || "",
    serviceAddress:  s.serviceAddress  || "",
    serviceLocation: s.serviceLocation || "",
    orderNumber:     s.orderNumber     || "",
    reason:          s.reason          || "",
    scheduledDate:   formatDate(s.scheduledDate),
    orderDate:       formatDate(s.orderDate), 
    createdBy:       s.createdBy       || "",
    createdAt:       formatDate(s.createdAt),
    reason:          REASON_MAP[s.reason] || s.reason || "",
  };
}


async function streamCursorToSheet(cursor, sheet, rowTransformer, options = {}) {
  const { isLegacy = false, includeOldData = false } = options;
  let count = 0;

  for await (const doc of cursor) {
    const row = sheet.addRow(rowTransformer(doc, isLegacy ? "legacy" : "current"));
    if (includeOldData && isLegacy) highlightRow(row, LEGACY_ROW_COLOR);
    count++;
    if (count % BATCH_SIZE === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return count;
}


export async function streamExcelExport(
  { type, includeOldData = false, dateFrom = null, dateTo = null },
  res
) {
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
  const sheet   = workbook.addWorksheet("Serviços");
  sheet.columns = getServiceColumns(includeOldData);

  const headerRow = sheet.getRow(1);
  styleHeaderRow(headerRow, HEADER_COLOR_SERVICES);
  headerRow.commit();

  const Service    = await getServiceModel();
  const dateFilter = buildDateRange(dateFrom, dateTo, "createdAt");

  const currentCursor = Service.find(dateFilter)
    .populate({ path: "client", populate: { path: "parent", select: "name" } })
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  const currentCount = await streamCursorToSheet(currentCursor, sheet, serviceToRow, {
    isLegacy: false,
    includeOldData,
  });

  console.log(`✅ Serviços atuais escritos: ${currentCount}`);

  if (includeOldData) {
    const ServiceLegacy = await getServiceLegacyModel();
    const legacyFilter  = buildDateRange(dateFrom, dateTo, "validatedAt");

    const legacyCursor = ServiceLegacy.find(legacyFilter)
      .sort({ validatedAt: -1 })
      .lean()
      .cursor({ batchSize: BATCH_SIZE });

    const legacyCount = await streamCursorToSheet(legacyCursor, sheet, serviceToRow, {
      isLegacy: true,
      includeOldData,
    });

    console.log(`✅ Serviços legados escritos: ${legacyCount}`);
    addLegendToStream(sheet);
  }

  sheet.commit();
}

async function streamSchedules(workbook, { dateFrom, dateTo }) {
  const sheet   = workbook.addWorksheet("Agendamentos");
  sheet.columns = getScheduleColumns();

  const headerRow = sheet.getRow(1);
  styleHeaderRow(headerRow, HEADER_COLOR_SCHEDULES);
  headerRow.commit();

  const Schedule   = await getScheduleModel();
  const dateFilter = buildDateRange(dateFrom, dateTo, "createdAt");

  const cursor = Schedule.find(dateFilter)
    .populate({ path: "client", populate: { path: "parent", select: "name" } })
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  const count = await streamCursorToSheet(cursor, sheet, scheduleToRow);
  console.log(`✅ Agendamentos escritos: ${count}`);

  sheet.commit();
}

function addLegendToStream(sheet) {
  sheet.addRow({}).commit();

  const title = sheet.addRow({ vin: "LEGENDA:" });
  title.getCell(1).font = { bold: true };
  title.commit();

  sheet.addRow({ vin: "⬜", plate: "Dados atuais" }).commit();

  const legacyRow = sheet.addRow({ vin: "🟨", plate: "Dados legados (importação anterior)" });
  [1, 2].forEach((col) => {
    legacyRow.getCell(col).fill = {
      type: "pattern", pattern: "solid", fgColor: { argb: LEGACY_ROW_COLOR },
    };
  });
  legacyRow.commit();
}