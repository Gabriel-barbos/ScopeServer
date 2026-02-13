import getScheduleModel from "../models/Schedule.js";
import getClientModel from "../models/Client.js";
import getProductModel from "../models/Product.js";
import {
  normalizeServiceType,
  normalizeStatus,
  parseDate,
  handleError,
  validateBulkArray
} from "../utils/scheduleHelper.js";

const NOT_FOUND_MSG = "Agendamento não encontrado";

class ScheduleController {
  constructor() {
    this.create = this.create.bind(this);
    this.list = this.list.bind(this);
    this.findById = this.findById.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
    this.bulkCreate = this.bulkCreate.bind(this);
    this.bulkUpdate = this.bulkUpdate.bind(this);
  }

  async create(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      const schedule = await Schedule.create(req.body);
      res.status(201).json(schedule);
    } catch (error) {
      handleError(res, error, 400);
    }
  }

  // ─── LIST com paginação e busca ───────────────────────────────────────────

  async list(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
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

  // ─────────────────────────────────────────────────────────────────────────

  async findById(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      const schedule = await Schedule.findById(req.params.id)
        .populate("client")
        .populate("product");

      if (!schedule) {
        return res.status(404).json({ error: NOT_FOUND_MSG });
      }
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

      if (!schedule) {
        return res.status(404).json({ error: NOT_FOUND_MSG });
      }
      res.json(schedule);
    } catch (error) {
      handleError(res, error, 400);
    }
  }

  async delete(req, res) {
    try {
      const Schedule = await getScheduleModel();

      const schedule = await Schedule.findByIdAndDelete(req.params.id);

      if (!schedule) {
        return res.status(404).json({ error: NOT_FOUND_MSG });
      }
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

      if (!schedule) {
        return res.status(404).json({ error: NOT_FOUND_MSG });
      }
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

        return {
          ...schedule,
          serviceType: normalizeServiceType(schedule.serviceType),
          scheduledDate: parseDate(schedule.scheduledDate)
        };
      });

      if (errors.length > 0) {
        return res.status(400).json({
          error: "Erros de validação",
          details: errors.slice(0, 10)
        });
      }

      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      const created = await Schedule.insertMany(processedSchedules, { ordered: false });

      res.status(201).json({
        success: true,
        count: created.length,
        message: `${created.length} agendamento(s) criado(s) com sucesso`
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
        return res.status(400).json({
          error: "Erros de validação",
          details: errors.slice(0, 20)
        });
      }

      const { successCount, updateErrors } = await this.#executeUpdates(updates);

      if (updateErrors.length > 0) {
        return res.status(207).json({
          success: true,
          count: successCount,
          message: `${successCount} modificado(s), ${updateErrors.length} falharam`,
          errors: updateErrors.slice(0, 10)
        });
      }

      res.json({
        success: true,
        count: successCount,
        message: `${successCount} agendamento(s) modificado(s) com sucesso`
      });
    } catch (error) {
      handleError(res, error);
    }
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  #buildFilter(query) {
    const filter = {};

    if (query.search) {
      const regex = new RegExp(query.search, "i");
      filter.$or = [
        { vin: regex },
        { plate: regex },
      ];
    }

    if (query.status) filter.status = query.status;
    if (query.serviceType) filter.serviceType = query.serviceType;
    if (query.client) filter.client = query.client;

    return filter;
  }

  #validateSchedule(schedule, idx) {
    const errors = [];
    const requiredFields = ["vin", "model", "serviceType", "client"];

    requiredFields.forEach(field => {
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
    const errors = [];
    const updates = [];

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];

      if (!schedule.vin) {
        errors.push(`Linha ${i + 1}: Chassi obrigatório`);
        continue;
      }

      const Schedule = await getScheduleModel();
      const exists = await Schedule.exists({ vin: schedule.vin });
      if (!exists) {
        errors.push(`Linha ${i + 1}: Chassi ${schedule.vin} não encontrado`);
        continue;
      }

      updates.push({
        vin: schedule.vin,
        updateData: this.#buildUpdateData(schedule)
      });
    }

    return { updates, errors };
  }

  #buildUpdateData(schedule) {
    const updateData = {};
    const fieldMap = {
      status: () => normalizeStatus(schedule.status),
      client: () => schedule.client,
      scheduledDate: () => parseDate(schedule.scheduledDate),
      model: () => schedule.model,
      plate: () => schedule.plate,
      serviceType: () => normalizeServiceType(schedule.serviceType),
      product: () => schedule.product,
      orderNumber: () => schedule.orderNumber,
      notes: () => schedule.notes
    };

    Object.entries(fieldMap).forEach(([key, getValue]) => {
      if (schedule[key]) {
        const value = getValue();
        if (value) updateData[key] = value;
      }
    });

    return updateData;
  }

  async #executeUpdates(updates) {
    let successCount = 0;
    const updateErrors = [];

    const Schedule = await getScheduleModel();
    const bulkOps = updates.map(({ vin, updateData }) => ({
      updateOne: {
        filter: { vin },
        update: { $set: updateData }
      }
    }));

    try {
      const result = await Schedule.bulkWrite(bulkOps, { ordered: false });
      successCount = result.modifiedCount;
    } catch (error) {
      if (error.writeErrors) {
        error.writeErrors.forEach(e => updateErrors.push(e.errmsg));
      }
      successCount = error.result?.nModified || 0;
    }

    return { successCount, updateErrors };
  }
}

export default new ScheduleController();