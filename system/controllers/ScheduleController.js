import Schedule from "../models/Schedule.js";
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
  
  // CRUD Básico
  async create(req, res) {
    try {
      const schedule = await Schedule.create(req.body);
      res.status(201).json(schedule);
    } catch (error) {
      handleError(res, error, 400);
    }
  }

  async list(req, res) {
    try {
      const schedules = await Schedule.find()
        .populate("client", "name image")
        .populate("product", "name")
        .sort({ scheduledDate: 1 });
      res.json(schedules);
    } catch (error) {
      handleError(res, error);
    }
  }

  async findById(req, res) {
    try {
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

  // Bulk Operations
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

  // Métodos privados auxiliares
  #validateSchedule(schedule, idx) {
    const errors = [];
    const requiredFields = ['vin', 'model', 'serviceType', 'client'];
    
    requiredFields.forEach(field => {
      if (!schedule[field]) {
        const labels = { vin: 'Chassi', model: 'Modelo', serviceType: 'Tipo de serviço', client: 'Cliente' };
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

    // Usar bulkWrite para melhor performance
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