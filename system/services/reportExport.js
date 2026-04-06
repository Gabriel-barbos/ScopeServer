import ExcelJS from "exceljs";
import getScheduleModel from "../models/Schedule.js";
import getServiceModel from "../models/Service.js";
import getServiceLegacyModel from "../models/ServiceLegacy.js";


const SERVICE_TYPE_MAP = {
  installation: "Instalação",
  maintenance:  "Manutenção",
  removal:      "Desinstalação",
  reinstallation: "Reinstalação",
  diagnostic:   "Remoção Diagnóstico",
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
const SCHEDULE_FIELD_COLOR = "FFD6E4FF";

function toDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

const DATE_FMT = "dd/mm/yyyy";

function buildDateRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};

  const parseUTC = (str, endOfDay = false) => {
    const [y, m, d] = str.split("-").map(Number);
    return endOfDay
      ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
      : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  };

  const start = dateFrom ? parseUTC(dateFrom, false) : null;
  const end   = dateTo   ? parseUTC(dateTo,   true)  : null;

  const makeRange = (field) => {
    const r = {};
    if (start) r.$gte = start;
    if (end)   r.$lte = end;
    return { [field]: r };
  };

  return {
    $or: [
      { source: { $ne: "import" }, ...makeRange("createdAt")   },
      { source: "import", validatedAt: { $ne: null }, ...makeRange("validatedAt") },
      { source: "import", validatedAt: null,          ...makeRange("createdAt")   },
    ],
  };
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
    { header: "Data da Solicitação",    key: "orderDate",            width: 18, numFmt: DATE_FMT },
    { header: "Data de Instalação",     key: "validatedAt",          width: 18, numFmt: DATE_FMT },
    { header: "Cliente",                key: "client",               width: 24 },
    { header: "Sub-cliente",            key: "subClient",            width: 24 },
    { header: "Dispositivo Secundário", key: "secondaryDevice",      width: 20 },
    { header: "Modelo",                 key: "model",                width: 18 },
    { header: "Odômetro (km)",          key: "odometer",             width: 14 },
    { header: "Prestador",              key: "provider",             width: 20 },
    { header: "Técnico",                key: "technician",           width: 20 },
    { header: "Endereço do Serviço",    key: "serviceAddress",       width: 30 },
    { header: "Local de Instalação",    key: "installationLocation", width: 24 },
    { header: "Bloqueio",               key: "blocking",             width: 10 },
    { header: "Validado por",           key: "validatedBy",          width: 18 },
    { header: "Nº Protocolo",           key: "protocolNumber",       width: 16 },
    { header: "Criado por",             key: "createdBy",            width: 18 },
    { header: "Data de Criação",        key: "createdAt",            width: 18, numFmt: DATE_FMT },
    { header: "Observações",            key: "notes",                width: 18 },
    { header: "Notas de Validação",     key: "validationNotes",      width: 18 },
    { header: "Motivo",                 key: "reason",               width: 18 },
    //campos herdados do agendamento (azul claro)
    { header: "Nº Pedido",             key: "orderNumber",      width: 16 },
    { header: "Data Agendada",         key: "scheduledDate",    width: 18, numFmt: DATE_FMT },
    { header: "Responsável",           key: "responsible",      width: 20 },
    { header: "Tel. Responsável",      key: "responsiblePhone", width: 18 },
    { header: "Condutor",              key: "condutor",         width: 20 },
    { header: "Local do Serviço",      key: "serviceLocation",  width: 24 },
    { header: "Grupo de Veículos",     key: "vehicleGroup",     width: 20 },
    { header: "Situação",              key: "situation",        width: 18 },
    { header: "Ticket Nº",             key: "ticketNumber",     width: 16 },
    { header: "Assunto",               key: "subject",          width: 24 },
    { header: "Descrição",             key: "description",      width: 30 },
    { header: "Categoria",             key: "category",         width: 18 },
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
    { header: "Data Agendada",       key: "scheduledDate",    width: 16, numFmt: DATE_FMT },
    { header: "Criado por",          key: "createdBy",        width: 18 },
    { header: "Data de Criação",     key: "createdAt",        width: 18, numFmt: DATE_FMT },
    { header: "Data do Pedido",      key: "orderDate",        width: 18, numFmt: DATE_FMT },
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
    plate:                s.plate                || "",
    vin:                  s.vin                  || "",
    deviceId:             s.deviceId             || "",
    product:              source === "legacy" ? (s.product || "") : (s.product?.name || ""),
    serviceType:          SERVICE_TYPE_MAP[s.serviceType] || s.serviceType || "",
    status:               s.status               || "",
    orderDate:            toDate(s.orderDate),
    validatedAt:          toDate(s.validatedAt),
    client:               clientName,
    subClient:            subClientName,
    secondaryDevice:      s.secondaryDevice      || "",
    model:                s.model                || "",
    odometer:             s.odometer             ?? "",
    provider:             s.provider             || "",
    technician:           s.technician           || "",
    serviceAddress:       s.serviceAddress       || "",
    installationLocation: s.installationLocation || "",
    blocking:             s.blockingEnabled ? "Sim" : "Não",
    protocolNumber:       s.protocolNumber       || "",
    validatedBy:          s.validatedBy          || "",
    createdBy:            s.createdBy            || "",
    createdAt:            toDate(s.createdAt),
    notes:                s.notes                || "",
    validationNotes:      s.validationNotes      || "",
    reason:               REASON_MAP[s.reason]   || s.reason || "",
    //campos herdados do agendamento —
    orderNumber:          s.orderNumber          || "",
    scheduledDate:        toDate(s.scheduledDate),
    responsible:          s.responsible          || "",
    responsiblePhone:     s.responsiblePhone     || "",
    condutor:             s.condutor             || "",
    serviceLocation:      s.serviceLocation      || "",
    vehicleGroup:         s.vehicleGroup         || "",
    situation:            s.situation            || "",
    ticketNumber:         s.ticketNumber         || "",
    subject:              s.subject              || "",
    description:          s.description          || "",
    category:             s.category             || "",
    source:               source === "legacy" ? "Legado" : "Atual",
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
    scheduledDate:   toDate(s.scheduledDate),
    orderDate:       toDate(s.orderDate),
    createdBy:       s.createdBy       || "",
    createdAt:       toDate(s.createdAt),
    reason:          REASON_MAP[s.reason] || s.reason || "",
  };
}


async function streamCursorToSheet(cursor, sheet, rowTransformer, options = {}) {
  const { isLegacy = false, includeOldData = false } = options;
  let count = 0;

  try {
    for await (const doc of cursor) {
      const row = sheet.addRow(rowTransformer(doc, isLegacy ? "legacy" : "current"));
      row.commit();
      count++;
      if (count % BATCH_SIZE === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  } finally {
    await cursor.close();
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

  // Pinta de azul claro as colunas herdadas do agendamento
  const scheduleFieldKeys = [
    "orderNumber", "scheduledDate", "responsible", "responsiblePhone",
    "condutor", "serviceLocation", "vehicleGroup", "situation",
    "ticketNumber", "subject", "description", "category",
  ];
  sheet.columns.forEach((col, idx) => {
    if (scheduleFieldKeys.includes(col.key)) {
      headerRow.getCell(idx + 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: SCHEDULE_FIELD_COLOR },
      };
      // mantém o texto legível (fonte escura)
      headerRow.getCell(idx + 1).font = { bold: true, color: { argb: "FF1D3557" } };
    }
  });

  headerRow.commit();

  const Service    = await getServiceModel();
  const dateFilter = buildDateRange(dateFrom, dateTo);

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
  const dateFilter = buildDateRange(dateFrom, dateTo);

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