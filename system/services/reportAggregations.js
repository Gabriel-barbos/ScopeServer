import getScheduleModel from "../models/Schedule.js";
import getServiceModel from "../models/Service.js";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

export function toObjectId(id) {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export function buildDateFilter(query) {
  const { startDate, endDate } = query;
  if (!startDate && !endDate) return {};
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate)   filter.$lte = new Date(endDate);
  return { createdAt: filter };
}

//helper de cliente para resolver cliente/subcliente e montar match de ids para filtros
async function resolveClientScope(clientId) {
  const objectId = toObjectId(clientId);
  if (!objectId) return null;

  const { default: getClientModel } = await import("../models/Client.js");
  const Client = await getClientModel();
  const doc = await Client.findById(objectId).lean();
  if (!doc) return null;

  return {
    isSubclient: !!doc.parent,
    parentId:    doc.parent ? new ObjectId(doc.parent) : new ObjectId(doc._id),
    ownId:       new ObjectId(doc._id),
  };
}

// montar o match de servicesByType e schedulesByStatus
export async function buildClientMatchIds(clientId) {
  const scope = await resolveClientScope(clientId);
  if (!scope) return null;

  if (scope.isSubclient) return [scope.ownId];

  const { default: getClientModel } = await import("../models/Client.js");
  const Client = await getClientModel();
  const subclients = await Client.find({ parent: scope.parentId }, "_id").lean();
  return [scope.parentId, ...subclients.map((s) => new ObjectId(s._id))];
}


const resolveClientStages = [
  {
    $lookup: {
      from: "clients",
      localField: "client",
      foreignField: "_id",
      as: "_clientDoc",
    },
  },
  { $unwind: { path: "$_clientDoc", preserveNullAndEmptyArrays: false } },
  {
    $addFields: {
      _effectiveClientId: {
        $cond: [{ $ifNull: ["$_clientDoc.parent", false] }, "$_clientDoc.parent", "$_clientDoc._id"],
      },
      _subClientName: {
        $cond: [{ $ifNull: ["$_clientDoc.parent", false] }, "$_clientDoc.name", null],
      },
    },
  },
  {
    $lookup: {
      from: "clients",
      localField: "_effectiveClientId",
      foreignField: "_id",
      as: "_effectiveClientDoc",
    },
  },
  { $unwind: { path: "$_effectiveClientDoc", preserveNullAndEmptyArrays: false } },
];


export async function servicesByType(match) {
  const Service = await getServiceModel();
  const result = await Service.aggregate([
    { $match: match },
    { $group: { _id: "$serviceType", count: { $sum: 1 } } },
  ]);

  return {
    instalacoes:    result.find((r) => r._id === "installation")?.count ?? 0,
    manutencoes:    result.find((r) => r._id === "maintenance")?.count ?? 0,
    desinstalacoes: result.find((r) => r._id === "removal")?.count ?? 0,
  };
}

export async function schedulesByStatus(match) {
  const Schedule = await getScheduleModel();
  const result = await Schedule.aggregate([
    {
      $match: {
        ...match,
        status: { $in: ["criado", "agendado"] },
      },
    },
    {
      $group: {
        _id:   "$serviceType",
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    instalacoes:  result.find((r) => r._id === "installation")?.count ?? 0,
    manutencoes:  result.find((r) => r._id === "maintenance")?.count  ?? 0,
  };
}

// Pendências por cliente / subcliente

export async function pendingByClient(dateFilter, clientId) {
  const match = {
    status: { $in: ["criado", "agendado"] },
  };

   if (clientId) {
    const ids = await buildClientMatchIds(clientId);
    if (ids) match.client = { $in: ids };
  }

  const Schedule = await getScheduleModel();
  const result = await Schedule.aggregate([
    { $match: match },
    ...resolveClientStages,
    {
      $group: {
        _id: {
          clientName:    "$_effectiveClientDoc.name",
          subClientName: "$_subClientName",
          serviceType:   "$serviceType",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.clientName": 1, "_id.subClientName": 1 } },
  ]);

  const clientMap = new Map();

  result.forEach(({ _id, count }) => {
    const { clientName, subClientName, serviceType } = _id;

    if (!clientMap.has(clientName)) {
      clientMap.set(clientName, { installation: 0, maintenance: 0, removal: 0, subclients: new Map() });
    }

    const entry = clientMap.get(clientName);
    entry[serviceType] = (entry[serviceType] ?? 0) + count;

    if (subClientName) {
      if (!entry.subclients.has(subClientName)) {
        entry.subclients.set(subClientName, { installation: 0, maintenance: 0, removal: 0 });
      }
      const sub = entry.subclients.get(subClientName);
      sub[serviceType] = (sub[serviceType] ?? 0) + count;
    }
  });

  return Array.from(clientMap.entries()).map(([client, data]) => ({
    client,
    installation: data.installation,
    maintenance:  data.maintenance,
    removal:      data.removal,
    total:        data.installation + data.maintenance + data.removal,
    subclients:   Array.from(data.subclients.entries()).map(([name, types]) => ({
      name,
      installation: types.installation,
      maintenance:  types.maintenance,
      removal:      types.removal,
      total:        types.installation + types.maintenance + types.removal,
    })),
  }));
}

// Pendências por prestador 
export async function pendingByProvider(clientId) {
  const match = {
    status:   { $in: ["criado", "agendado"] },
    provider: { $exists: true, $ne: "" },
  };

  if (clientId) {
    const ids = await buildClientMatchIds(clientId);
    if (ids) match.client = { $in: ids };
  }

  const Schedule = await getScheduleModel();
  const result = await Schedule.aggregate([
    { $match: match },
    { $group: { _id: "$provider", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return result.map(({ _id, count }) => ({ provider: _id, pending: count }));
}


//evolução por mês e dia (total e por tipo de serviço)
export async function evolutionByMonth() {
  const Service = await getServiceModel();
  const result = await Service.aggregate([
    {
      $group: {
        _id: {
             year:        { $year:  { date: "$createdAt", timezone: "America/Sao_Paulo" } },
          month:       { $month: { date: "$createdAt", timezone: "America/Sao_Paulo" } },
          day:         { $dayOfMonth: { date: "$createdAt", timezone: "America/Sao_Paulo" } },
          serviceType: "$serviceType",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const map = new Map();
  result.forEach(({ _id, count }) => {
    const key = `${_id.year}-${String(_id.month).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, { installation: 0, maintenance: 0, removal: 0 });
    map.get(key)[_id.serviceType] = count;
  });

  return Array.from(map.entries()).map(([month, types]) => ({
    month,
    installation: types.installation,
    maintenance:  types.maintenance,
    removal:      types.removal,
    total:        types.installation + types.maintenance + types.removal,
  }));
}

export async function evolutionByDay() {
  const Service = await getServiceModel();
  const result = await Service.aggregate([
    {
      $group: {
        _id: {
          year:        { $year:  { date: "$createdAt", timezone: "America/Sao_Paulo" } },
          month:       { $month: { date: "$createdAt", timezone: "America/Sao_Paulo" } },
          day:         { $dayOfMonth: { date: "$createdAt", timezone: "America/Sao_Paulo" } },
          serviceType: "$serviceType",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ]);

  const monthMap = new Map();
  result.forEach(({ _id, count }) => {
    const monthKey = `${_id.year}-${String(_id.month).padStart(2, "0")}`;
    const dayKey   = String(_id.day).padStart(2, "0");
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map());
    const dayMap = monthMap.get(monthKey);
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, { installation: 0, maintenance: 0, removal: 0 });
    dayMap.get(dayKey)[_id.serviceType] = count;
  });

  const months = {};
  monthMap.forEach((dayMap, month) => {
    months[month] = Array.from(dayMap.entries()).map(([day, types]) => ({
      day:          `${month}-${day}`,
      installation: types.installation,
      maintenance:  types.maintenance,
      removal:      types.removal,
      total:        types.installation + types.maintenance + types.removal,
    }));
  });

  return months;
}

//serviços por cliente (total e por tipo)
export async function servicesByClient() {
  const Service = await getServiceModel();
  const result = await Service.aggregate([
    ...resolveClientStages,
    {
      $group: {
        _id:   "$_effectiveClientDoc.name",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  return result.map(({ _id, count }) => ({ client: _id, total: count }));
}

//report diario
export async function reportDaily(startDate, endDate) {
  let start, end;
  if (startDate && endDate) {
    start = new Date(startDate);
    end   = new Date(endDate);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(),  0,  0,  0);
    end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }

  const Service = await getServiceModel();
  const result = await Service.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    ...resolveClientStages,
    {
      $group: {
        _id: {
          client:      "$_effectiveClientDoc.name",
          subClient:   "$_subClientName",
          serviceType: "$serviceType",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.client": 1, "_id.subClient": 1 } },
  ]);

  const map = new Map();
  let totalInstallation = 0, totalMaintenance = 0, totalRemoval = 0;

  result.forEach(({ _id, count }) => {
    const { client, subClient, serviceType } = _id;

    if (!map.has(client)) {
      map.set(client, { installation: 0, maintenance: 0, removal: 0, subclients: new Map() });
    }

    const entry = map.get(client);
    entry[serviceType] = (entry[serviceType] ?? 0) + count;

    if (subClient) {
      if (!entry.subclients.has(subClient)) {
        entry.subclients.set(subClient, { installation: 0, maintenance: 0, removal: 0 });
      }
      const sub = entry.subclients.get(subClient);
      sub[serviceType] = (sub[serviceType] ?? 0) + count;
    }

    if (serviceType === "installation") totalInstallation += count;
    if (serviceType === "maintenance")  totalMaintenance  += count;
    if (serviceType === "removal")      totalRemoval      += count;
  });

  const clients = Array.from(map.entries()).map(([client, data]) => ({
    client,
    installation: data.installation,
    maintenance:  data.maintenance,
    removal:      data.removal,
    total:        data.installation + data.maintenance + data.removal,
    subclients:   Array.from(data.subclients.entries()).map(([name, types]) => ({
      name,
      installation: types.installation,
      maintenance:  types.maintenance,
      removal:      types.removal,
      total:        types.installation + types.maintenance + types.removal,
    })),
  }));

  return {
    totals: {
      installation: totalInstallation,
      maintenance:  totalMaintenance,
      removal:      totalRemoval,
      total:        totalInstallation + totalMaintenance + totalRemoval,
    },
    clients,
  };
}