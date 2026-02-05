import Schedule from "../models/Schedule.js";
import Service from "../models/Service.js";
import ExcelJS from "exceljs";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

// Helper para converter clientId de forma segura
function toObjectId(id) {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch {
    console.error("ID inválido:", id);
    return null;
  }
}

// Filtro base de data a partir dos query params
function buildDateFilter(query) {
  const { startDate, endDate } = query;
  if (!startDate && !endDate) return {};
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate) filter.$lte = new Date(endDate);
  return { createdAt: filter };
}

// Adiciona filtro de cliente se existir
function addClientFilter(match, clientId) {
  const objectId = toObjectId(clientId);
  if (objectId) match.client = objectId;
  return match;
}


  // GET - retorna todos os dados agregados de uma vez
  class ReportController {

  getReportData = async (req, res) => {
    try {
      const { startDate, endDate, clientId } = req.query;
      const dateFilter = buildDateFilter(req.query);
      const matchWithClient = addClientFilter({ ...dateFilter }, clientId);

      const [
        servicesByType,
        schedulesByStatus,
        pendingByClient,
        pendingByProvider,
        evolutionByMonth,
        evolutionByDay,
        servicesByClient,
        reportDaily,
      ] = await Promise.all([
        this.#servicesByType(matchWithClient),        // ✅ CORRIGIDO
        this.#schedulesByStatus(matchWithClient),
        this.#pendingByClient(dateFilter, clientId),
        this.#pendingByProvider(dateFilter, clientId),
        this.#evolutionByMonth(),                     // ✅ CORRIGIDO
        this.#evolutionByDay(),                       // ✅ CORRIGIDO
        this.#servicesByClient(),
        this.#reportDaily(startDate, endDate),
      ]);

      res.json({
        servicesByType,
        schedulesByStatus,
        pendingByClient,
        pendingByProvider,
        evolutionByMonth,
        evolutionByDay,
        servicesByClient,
        reportDaily,
      });
    } catch (error) {
      console.error("Erro no getReportData:", error);
      res.status(500).json({ error: error.message });
    }
  }


  // ✅ CORRIGIDO - Agora usa Service ao invés de Schedule
  async #servicesByType(match) {
    const result = await Service.aggregate([
      { $match: match },
      { $group: { _id: "$serviceType", count: { $sum: 1 } } },
    ]);

    return {
      instalacoes: result.find((r) => r._id === "installation")?.count ?? 0,
      manutencoes: result.find((r) => r._id === "maintenance")?.count ?? 0,
      desinstalacoes: result.find((r) => r._id === "removal")?.count ?? 0,
    };
  }

  // ✅ Permanece Schedule (métricas de agendamento)
  async #schedulesByStatus(match) {
    const result = await Schedule.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const criado = result.find((r) => r._id === "criado")?.count ?? 0;
    const agendado = result.find((r) => r._id === "agendado")?.count ?? 0;

    return {
      pendentes: criado + agendado,
      cancelados: result.find((r) => r._id === "cancelado")?.count ?? 0,
      concluidos: result.find((r) => r._id === "concluido")?.count ?? 0,
    };
  }

  // ✅ Permanece Schedule (agendamentos pendentes)
  async #pendingByClient(dateFilter, clientId) {
    const match = {
      ...dateFilter,
      status: { $in: ["criado", "agendado"] },
    };
    
    const objectId = toObjectId(clientId);
    if (objectId) match.client = objectId;

    const result = await Schedule.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "clients",
          localField: "client",
          foreignField: "_id",
          as: "clientData",
        },
      },
      { $unwind: "$clientData" },
      {
        $group: {
          _id: { client: "$clientData.name", serviceType: "$serviceType" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const map = new Map();
    result.forEach(({ _id, count }) => {
      if (!map.has(_id.client)) map.set(_id.client, {});
      map.get(_id.client)[_id.serviceType] = count;
    });

    return Array.from(map.entries()).map(([client, types]) => ({
      client,
      installation: types.installation ?? 0,
      maintenance: types.maintenance ?? 0,
      removal: types.removal ?? 0,
      total: (types.installation ?? 0) + (types.maintenance ?? 0) + (types.removal ?? 0),
    }));
  }

  // ✅ Permanece Schedule (agendamentos pendentes por prestador)
  async #pendingByProvider(dateFilter, clientId) {
    const match = {
      ...dateFilter,
      status: { $in: ["criado", "agendado"] },
      provider: { $exists: true, $ne: "" },
    };
    
    const objectId = toObjectId(clientId);
    if (objectId) match.client = objectId;

    const result = await Schedule.aggregate([
      { $match: match },
      { $group: { _id: "$provider", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return result.map(({ _id, count }) => ({ provider: _id, pending: count }));
  }

  // ✅ CORRIGIDO - Usa Service e data de criação do serviço
  async #evolutionByMonth() {
    const result = await Service.aggregate([
      {
        $group: {
          _id: { 
            year: { $year: "$createdAt" }, 
            month: { $month: "$createdAt" }, 
            serviceType: "$serviceType" 
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Reagrupa por ano-mês
    const map = new Map();
    result.forEach(({ _id, count }) => {
      const key = `${_id.year}-${String(_id.month).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, { installation: 0, maintenance: 0, removal: 0 });
      }
      map.get(key)[_id.serviceType] = count;
    });

    return Array.from(map.entries()).map(([month, types]) => ({
      month,
      installation: types.installation,
      maintenance: types.maintenance,
      removal: types.removal,
      total: types.installation + types.maintenance + types.removal,
    }));
  }

  // ✅ CORRIGIDO - Usa Service e data de criação do serviço
  async #evolutionByDay() {
    const result = await Service.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
            serviceType: "$serviceType",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Reagrupa por mês e depois por dia
    const monthMap = new Map();
    result.forEach(({ _id, count }) => {
      const monthKey = `${_id.year}-${String(_id.month).padStart(2, "0")}`;
      const dayKey = String(_id.day).padStart(2, "0");

      if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map());
      const dayMap = monthMap.get(monthKey);

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { installation: 0, maintenance: 0, removal: 0 });
      }
      dayMap.get(dayKey)[_id.serviceType] = count;
    });

    // Transforma em array estruturado
    const months = {};
    monthMap.forEach((dayMap, month) => {
      months[month] = Array.from(dayMap.entries()).map(([day, types]) => ({
        day: `${month}-${day}`,
        installation: types.installation,
        maintenance: types.maintenance,
        removal: types.removal,
        total: types.installation + types.maintenance + types.removal,
      }));
    });

    return months;
  }

  // ✅ Permanece Service (correto)
  async #servicesByClient() {
    const result = await Service.aggregate([
      {
        $lookup: {
          from: "clients",
          localField: "client",
          foreignField: "_id",
          as: "clientData",
        },
      },
      { $unwind: "$clientData" },
      { $group: { _id: "$clientData.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return result.map(({ _id, count }) => ({ client: _id, total: count }));
  }

  // ✅ Permanece Service (correto)
  async #reportDaily(startDate, endDate) {
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    const result = await Service.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $lookup: {
          from: "clients",
          localField: "client",
          foreignField: "_id",
          as: "clientData",
        },
      },
      { $unwind: "$clientData" },
      {
        $group: {
          _id: { client: "$clientData.name", serviceType: "$serviceType" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.client": 1 } },
    ]);

    const map = new Map();
    let totalInstallation = 0, totalMaintenance = 0, totalRemoval = 0;

    result.forEach(({ _id, count }) => {
      if (!map.has(_id.client)) {
        map.set(_id.client, { installation: 0, maintenance: 0, removal: 0 });
      }
      map.get(_id.client)[_id.serviceType] = count;

      if (_id.serviceType === "installation") totalInstallation += count;
      if (_id.serviceType === "maintenance") totalMaintenance += count;
      if (_id.serviceType === "removal") totalRemoval += count;
    });

    const clients = Array.from(map.entries()).map(([client, types]) => ({
      client,
      installation: types.installation,
      maintenance: types.maintenance,
      removal: types.removal,
      total: types.installation + types.maintenance + types.removal,
    }));

    return {
      totals: {
        installation: totalInstallation,
        maintenance: totalMaintenance,
        removal: totalRemoval,
        total: totalInstallation + totalMaintenance + totalRemoval,
      },
      clients,
    };
  }

  // --- Export Excel ---

  // GET /api/reports/export?type=schedules|services
  exportData = async (req, res) => {
    try {
      const { type } = req.query;
      if (!["schedules", "services"].includes(type)) {
        return res.status(400).json({ error: "Tipo invalido. Use 'schedules' ou 'services'" });
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Sistema";
      workbook.created = new Date();

      if (type === "schedules") {
        await this.#exportSchedules(workbook);
      } else {
        await this.#exportServices(workbook);
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${type}-report.xlsx`);
      await workbook.xlsx.write(res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async #exportSchedules(workbook) {
    const schedules = await Schedule.find()
      .populate("client", "name")
      .populate("product", "name")
      .sort({ createdAt: -1 })
      .lean();

    const sheet = workbook.addWorksheet("Agendamentos");

    // Header
    const headers = ["Chassi", "Placa", "Modelo", "Cliente", "Equipamento", "Tipo de Servico", "Status", "Prestador", "Data Agendada", "Criado por", "Data de Criacao"];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1890FF" } };
    sheet.getRow(1).alignment = { horizontal: "center" };

    // Mapeamento de tipos de servico
    const serviceTypeMap = { installation: "Instalacao", maintenance: "Manutencao", removal: "Desinstalacao" };
    const statusMap = { criado: "Criado", agendado: "Agendado", concluido: "Concluido", atrasado: "Atrasado", cancelado: "Cancelado" };

    // Dados
    schedules.forEach((s) => {
      sheet.addRow([
        s.vin,
        s.plate || "",
        s.model || "",
        s.client?.name || "",
        s.product?.name || "",
        serviceTypeMap[s.serviceType] || s.serviceType,
        statusMap[s.status] || s.status,
        s.provider || "",
        s.scheduledDate ? this.#formatDate(s.scheduledDate) : "",
        s.createdBy || "",
        s.createdAt ? this.#formatDate(s.createdAt) : "",
      ]);
    });

    // Ajusta largura das colunas
    const colWidths = [22, 12, 18, 24, 22, 16, 12, 20, 16, 18, 18];
    colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
  }

  async #exportServices(workbook) {
    const services = await Service.find()
      .populate("client", "name")
      .populate("product", "name")
      .sort({ createdAt: -1 })
      .lean();

    const sheet = workbook.addWorksheet("Servicos");

    const headers = [
      "Chassi", "Placa", "Modelo", "Cliente", "Equipamento",
      "Tipo de Servico", "ID Dispositivo","status", "Tecnico", "Prestador",
      "Local de Instalacao", "Endereco", "Odometro (km)", "Bloqueio",
      "No Protocolo", "Dispositivo Secundario", "Validado por",
      "Data de Validacao", "Criado por", "Data de Criacao",
    ];

    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF722ED1" } };
    sheet.getRow(1).alignment = { horizontal: "center" };

    const serviceTypeMap = { installation: "Instalacao", maintenance: "Manutencao", removal: "Desinstalacao" };

    services.forEach((s) => {
      sheet.addRow([
        s.vin,
        s.plate || "",
        s.model || "",
        s.client?.name || "",
        s.product?.name || "",
        serviceTypeMap[s.serviceType] || s.serviceType,
        s.deviceId || "",
        s.status || "",
        s.technician || "",
        s.provider || "",
        s.installationLocation || "",
        s.serviceAddress || "",
        s.odometer ?? "",
        s.blockingEnabled ? "Sim" : "Nao",
        s.protocolNumber || "",
        s.secondaryDevice || "",
        s.validatedBy || "",
        s.validatedAt ? this.#formatDate(s.validatedAt) : "",
        s.createdBy || "",
        s.createdAt ? this.#formatDate(s.createdAt) : "",
      ]);
    });

    const colWidths = [22, 12, 18, 24, 22, 16, 18, 20, 20, 24, 28, 14, 10, 16, 20, 18, 18, 18, 18];
    colWidths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
  }

  // Formata Date para DD/MM/YYYY
  #formatDate(date) {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
}

export default new ReportController();