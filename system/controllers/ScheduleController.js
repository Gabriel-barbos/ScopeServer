import getScheduleModel from "../models/Schedule.js";
import getClientModel from "../models/Client.js";
import getProductModel from "../models/Product.js";
import {
  normalizeServiceType,
  normalizeStatus,
  parseDate,
  handleError,
  validateBulkArray,
  checkDuplicateVin,
} from "../utils/scheduleHelper.js";

const NOT_FOUND_MSG = "Agendamento não encontrado";

function resolveResponsible(data) {
  return data.responsible || data.createdBy || undefined;
}


class ScheduleController {
  constructor() {
    this.create       = this.create.bind(this);
    this.list         = this.list.bind(this);
    this.findById     = this.findById.bind(this);
    this.update       = this.update.bind(this);
    this.delete       = this.delete.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
    this.bulkCreate   = this.bulkCreate.bind(this);
    this.bulkUpdate   = this.bulkUpdate.bind(this);
  }

  async create(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      // Verifica duplicata por chassi antes de criar
      const duplicate = await checkDuplicateVin(req.body.vin, Schedule);
      if (duplicate) {
        return res.status(409).json({
          error: `Chassi "${req.body.vin}" já possui um agendamento ativo (status: ${duplicate.status})`,
          activeScheduleId: duplicate._id,
        });
      }

      const schedule = await Schedule.create({
        ...req.body,
        responsible: resolveResponsible(req.body),
      });

      res.status(201).json(schedule);
    } catch (error) {
      handleError(res, error, 400);
    }
  }

  async list(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
      const skip  = (page - 1) * limit;

      const filter = this.#buildFilter(req.query);

      const [data, total] = await Promise.all([
        Schedule.find(filter)
          .populate("client", "name image")
          .populate("product", "name")
          .sort({ scheduledDate: 1 })
          .skip(skip)
          .limit(limit),
        Schedule.countDocuments(filter),
      ]);

      res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  }

  async findById(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      const schedule = await Schedule.findById(req.params.id)
        .populate("client")
        .populate("product");

      if (!schedule) return res.status(404).json({ error: NOT_FOUND_MSG });
      res.json(schedule);
    } catch (error) {
      handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      const schedule = await Schedule.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!schedule) return res.status(404).json({ error: NOT_FOUND_MSG });
      res.json(schedule);
    } catch (error) {
      handleError(res, error, 400);
    }
  }

  async delete(req, res) {
    try {
      const Schedule = await getScheduleModel();
      const schedule = await Schedule.findByIdAndDelete(req.params.id);
      if (!schedule) return res.status(404).json({ error: NOT_FOUND_MSG });
      res.status(204).send();
    } catch (error) {
      handleError(res, error);
    }
  }

  async updateStatus(req, res) {
    try {
      const Schedule = await getScheduleModel();
      const schedule = await Schedule.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );
      if (!schedule) return res.status(404).json({ error: NOT_FOUND_MSG });
      res.json(schedule);
    } catch (error) {
      handleError(res, error, 400);
    }
  }

  async bulkCreate(req, res) {
    try {
      const { schedules } = req.body;
      if (!validateBulkArray(schedules, res)) return;

      const errors = [];
      const processedSchedules = schedules.map((schedule, idx) => {
        const lineErrors = this.#validateSchedule(schedule, idx);
        errors.push(...lineErrors);

        const serviceType = normalizeServiceType(schedule.serviceType);
        if (!serviceType) {
          errors.push(`Linha ${idx + 1}: Tipo de serviço inválido: "${schedule.serviceType}"`);
        }

        return {
          ...schedule,
          serviceType:   serviceType,
          scheduledDate: parseDate(schedule.scheduledDate),
          orderDate:     parseDate(schedule.orderDate),
          responsible:   resolveResponsible(schedule),
          _originalIndex: idx,
        };
      });

      if (errors.length > 0) {
        return res.status(400).json({ error: "Erros de validação", details: errors.slice(0, 10) });
      }

      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      // Verifica duplicatas por chassi em paralelo
      const duplicateChecks = await Promise.all(
        processedSchedules.map((s) => checkDuplicateVin(s.vin, Schedule))
      );

      const valid    = [];
      const rejected = [];

      processedSchedules.forEach((s, i) => {
        const { _originalIndex, ...scheduleData } = s;
        if (duplicateChecks[i]) {
          rejected.push({
            line:   _originalIndex + 1,
            vin:    s.vin,
            reason: `Chassi já possui agendamento ativo (status: ${duplicateChecks[i].status})`,
          });
        } else {
          valid.push(scheduleData);
        }
      });

      const created = valid.length > 0
        ? await Schedule.insertMany(valid, { ordered: false })
        : [];

      const statusCode = rejected.length > 0 ? 207 : 201;
      res.status(statusCode).json({
        success:         true,
        created:         created.length,
        rejected:        rejected.length,
        message:         `${created.length} agendamento(s) criado(s)${
          rejected.length > 0 ? `, ${rejected.length} rejeitado(s) por duplicata` : ""
        }`,
        ...(rejected.length > 0 && { rejectedDetails: rejected }),
      });
    } catch (error) {
      handleError(res, error);
    }
  }

  async bulkUpdate(req, res) {
    try {
      const { schedules } = req.body;
      if (!validateBulkArray(schedules, res)) return;

      const { updates, errors } = await this.#processUpdates(schedules);

      if (errors.length > 0) {
        return res.status(400).json({ error: "Erros de validação", details: errors.slice(0, 20) });
      }

      const { successCount, updateErrors } = await this.#executeUpdates(updates);

      if (updateErrors.length > 0) {
        return res.status(207).json({
          success: true,
          count:   successCount,
          message: `${successCount} modificado(s), ${updateErrors.length} falharam`,
          errors:  updateErrors.slice(0, 10),
        });
      }

      res.json({
        success: true,
        count:   successCount,
        message: `${successCount} agendamento(s) modificado(s) com sucesso`,
      });
    } catch (error) {
      handleError(res, error);
    }
  }

  // Helpers privados 

  #buildFilter(query) {
    const filter = {};

    if (query.search) {
      const regex = new RegExp(query.search, "i");
      filter.$or = [{ vin: regex }, { plate: regex }];
    }

    if (query.status) {
      const values = query.status.split(",").map((s) => s.trim()).filter(Boolean);
      filter.status = values.length === 1 ? values[0] : { $in: values };
    }

    if (query.serviceType) {
      const values = query.serviceType.split(",").map((s) => s.trim()).filter(Boolean);
      filter.serviceType = values.length === 1 ? values[0] : { $in: values };
    }

    if (query.client) {
      const values = query.client.split(",").map((s) => s.trim()).filter(Boolean);
      filter.client = values.length === 1 ? values[0] : { $in: values };
    }

    if (query.responsible) {
      filter.responsible = new RegExp(query.responsible, "i");
    }

    return filter;
  }

  #validateSchedule(schedule, idx) {
    const errors = [];
    const requiredFields = ["vin", "model", "serviceType", "client"];
    requiredFields.forEach((field) => {
      if (!schedule[field]) {
        const labels = { vin: "Chassi", model: "Modelo", serviceType: "Tipo de serviço", client: "Cliente" };
        errors.push(`Linha ${idx + 1}: ${labels[field]} obrigatório`);
      }
    });
    const normalizedType = normalizeServiceType(schedule.serviceType);
    if (normalizedType === "installation" && !schedule.product) {
      errors.push(`Linha ${idx + 1}: Produto obrigatório para instalação`);
    }
    return errors;
  }

  async #processUpdates(schedules) {
    const errors  = [];
    const updates = [];

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      if (!schedule.vin) {
        errors.push(`Linha ${i + 1}: Chassi obrigatório`);
        continue;
      }
      const Schedule = await getScheduleModel();
      const exists   = await Schedule.exists({ vin: schedule.vin });
      if (!exists) {
        errors.push(`Linha ${i + 1}: Chassi ${schedule.vin} não encontrado`);
        continue;
      }
      updates.push({ vin: schedule.vin, updateData: this.#buildUpdateData(schedule) });
    }

    return { updates, errors };
  }

  #buildUpdateData(schedule) {
    const dateFields = new Set(["scheduledDate", "orderDate", "removalDate"]);
    const normalizers = {
      status:      (v) => normalizeStatus(v),
      serviceType: (v) => normalizeServiceType(v),
    };

    const ALL_FIELDS = [
      "status", "client", "product", "serviceType",
      "scheduledDate", "orderDate", "removalDate",
      "model", "plate", "vin",
      "orderNumber", "notes", "responsible", "responsiblePhone",
      "condutor", "provider",
      "serviceAddress", "serviceLocation","reason",
      "situation", "source", "vehicleGroup",
      "ticketNumber", "subject", "description", "category",
    ];

    const updateData = {};

    for (const key of ALL_FIELDS) {
      if (schedule[key] == null || schedule[key] === "") continue;

      let value = schedule[key];

      if (dateFields.has(key))       value = parseBRDate(value) ?? parseDate(value);
      else if (normalizers[key])     value = normalizers[key](value);

      if (value != null) updateData[key] = value;
    }

    return updateData;
  }

  async #executeUpdates(updates) {
    let successCount  = 0;
    const updateErrors = [];

    const Schedule = await getScheduleModel();
    const bulkOps  = updates.map(({ vin, updateData }) => ({
      updateOne: { filter: { vin }, update: { $set: updateData } },
    }));

    try {
      const result = await Schedule.bulkWrite(bulkOps, { ordered: false });
      successCount = result.modifiedCount;
    } catch (error) {
      if (error.writeErrors) {
        error.writeErrors.forEach((e) => updateErrors.push(e.errmsg));
      }
      successCount = error.result?.nModified || 0;
    }

    return { successCount, updateErrors };
  }
}

export default new ScheduleController();