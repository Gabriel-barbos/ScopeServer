import getScheduleModel from "../models/Schedule.js";
import getServiceModel from "../models/Service.js";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Types;

export function toObjectId(id) {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch {
    console.error("ID inválido:", id);
    return null;
  }
}

export function buildDateFilter(query) {
  const { startDate, endDate } = query;
  if (!startDate && !endDate) return {};
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate) filter.$lte = new Date(endDate);
  return { createdAt: filter };
}

export function addClientFilter(match, clientId) {
  const objectId = toObjectId(clientId);
  if (objectId) match.client = objectId;
  return match;
}

// ─── Agregações ──────────────────────────────────────────

export async function servicesByType(match) {
  const Service = await getServiceModel();
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

export async function schedulesByStatus(match) {
  const Schedule = await getScheduleModel();
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

export async function pendingByClient(dateFilter, clientId) {
  const match = {
    ...dateFilter,
    status: { $in: ["criado", "agendado"] },
  };

  const objectId = toObjectId(clientId);
  if (objectId) match.client = objectId;

  const Schedule = await getScheduleModel();
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
    total:
      (types.installation ?? 0) +
      (types.maintenance ?? 0) +
      (types.removal ?? 0),
  }));
}

export async function pendingByProvider(dateFilter, clientId) {
  const match = {
    ...dateFilter,
    status: { $in: ["criado", "agendado"] },
    provider: { $exists: true, $ne: "" },
  };

  const objectId = toObjectId(clientId);
  if (objectId) match.client = objectId;

  const Schedule = await getScheduleModel();
  const result = await Schedule.aggregate([
    { $match: match },
    { $group: { _id: "$provider", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return result.map(({ _id, count }) => ({ provider: _id, pending: count }));
}

export async function evolutionByMonth() {
  const Service = await getServiceModel();
  const result = await Service.aggregate([
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
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

export async function evolutionByDay() {
  const Service = await getServiceModel();
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

export async function servicesByClient() {
  const Service = await getServiceModel();
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

export async function reportDaily(startDate, endDate) {
  let start, end;
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }

  const Service = await getServiceModel();
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
  let totalInstallation = 0,
    totalMaintenance = 0,
    totalRemoval = 0;

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