export const normalizeServiceType = (type) => {
  if (!type) return null;

  const normalized = type
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "_");

  const mappings = {
    reinstal: "reinstallation", // antes de "instal"
    instal:   "installation",
    manut:    "maintenance",
    remo:     "removal",
    diagn:    "diagnostic",
    visita:   "diagnostic",
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key)) return value;
  }

  return null;
};

export const normalizeStatus = (status) => {
  if (!status) return null;
  const normalized = status
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "_");

  const mappings = {
    conclu: "concluido",
    agenda: "agendado",
    cria:   "criado",
    atrasa: "atrasado",
    cancel: "cancelado",
    frustr: "frustrado",
    aguard: "aguardando_cliente",
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (normalized.includes(key)) return value;
  }
  return status;
};

export const parseDate = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;

  if (typeof dateValue === "number") {
    return new Date((dateValue - 25569) * 86400 * 1000);
  }

  if (typeof dateValue === "string") {
    const parts = dateValue.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (!isNaN(date.getTime())) return date;
    }

    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
};

export const handleError = (res, error, defaultStatus = 500) => {
  if (error.name === "MongoBulkWriteError") {
    return res.status(400).json({
      error: "Alguns registros falharam",
      details: error.writeErrors?.map((e) => e.errmsg).slice(0, 10),
    });
  }
  return res.status(defaultStatus).json({ error: error.message });
};

export const validateBulkArray = (schedules, res) => {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    res.status(400).json({ error: "Envie um array de agendamentos" });
    return false;
  }
  if (schedules.length > 1000) {
    res.status(400).json({ error: "Limite de 1000 agendamentos por operação" });
    return false;
  }
  return true;
};