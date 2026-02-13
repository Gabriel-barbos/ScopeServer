import getServiceModel from "../models/Service.js";
import getScheduleModel from "../models/Schedule.js";
import getClientModel from "../models/Client.js";
import getProductModel from "../models/Product.js";

class ServiceController {

  constructor() {
    this.createFromValidation = this.createFromValidation.bind(this);
    this.create = this.create.bind(this);
    this.bulkImport = this.bulkImport.bind(this);
    this.list = this.list.bind(this);
    this.findById = this.findById.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
  }

  async createFromValidation(req, res) {
    try {
      const { scheduleId, validationData } = req.body;

      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();
      const Service = await getServiceModel();

      const schedule = await Schedule.findById(scheduleId)
        .populate("client")
        .populate("product");

      if (!schedule) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      const service = await Service.create({
        plate: schedule.plate,
        vin: schedule.vin,
        model: schedule.model,
        scheduledDate: schedule.scheduledDate,
        serviceType: schedule.serviceType,
        notes: schedule.notes,
        createdBy: schedule.createdBy,
        product: schedule.product,
        client: schedule.client,
        provider: schedule.provider,
        status: validationData.status,
        deviceId: validationData.deviceId,
        technician: validationData.technician,
        installationLocation: validationData.installationLocation,
        serviceAddress: validationData.serviceAddress,
        odometer: validationData.odometer,
        blockingEnabled: validationData.blockingEnabled,
        protocolNumber: validationData.protocolNumber,
        validationNotes: validationData.validationNotes,
        secondaryDevice: validationData.secondaryDevice,
        validatedBy: validationData.validatedBy,
        validatedAt: new Date(),
        schedule: scheduleId,
        source: "validation"
      });

      await Schedule.findByIdAndUpdate(scheduleId, {
        status: "concluido",
        service: service._id
      });

      return res.status(201).json(service);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      await getScheduleModel();
      const Service = await getServiceModel();

      const service = await Service.create({
        ...req.body,
        source: "import",
        validatedAt: new Date()
      });

      return res.status(201).json(service);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async bulkImport(req, res) {
    try {
      const { services } = req.body;

      if (!Array.isArray(services) || services.length === 0) {
        return res.status(400).json({ error: "Envie um array de serviços" });
      }

      if (services.length > 500) {
        return res.status(400).json({ error: "Limite de 500 serviços por operação" });
      }

      const errors = [];
      const processedServices = [];
      const clientsCache = new Map();
      const productsCache = new Map();

      for (let i = 0; i < services.length; i++) {
        const service = services[i];
        const lineNum = i + 1;

        const validation = this.#validateService(service, lineNum);
        if (validation.errors.length > 0) {
          errors.push(...validation.errors);
          continue;
        }

        const clientId = await this.#resolveClient(service.client, clientsCache);
        if (!clientId) {
          errors.push(`Linha ${lineNum}: Cliente "${service.client}" não encontrado`);
          continue;
        }

        let productId = null;
        if (service.product) {
          productId = await this.#resolveProduct(service.product, productsCache);
          if (!productId) {
            errors.push(`Linha ${lineNum}: Produto "${service.product}" não encontrado`);
            continue;
          }
        }

        const serviceType = this.#normalizeServiceType(service.serviceType);
        if (!serviceType) {
          errors.push(`Linha ${lineNum}: Tipo de serviço inválido`);
          continue;
        }

        processedServices.push({
          plate: service.plate,
          vin: service.vin,
          model: service.model,
          serviceType,
          client: clientId,
          product: productId,
          deviceId: service.deviceId,
          technician: service.technician,
          provider: service.provider,
          installationLocation: service.installationLocation,
          serviceAddress: service.serviceAddress,
          odometer: service.odometer,
          blockingEnabled: service.blockingEnabled ?? true,
          protocolNumber: service.protocolNumber,
          validationNotes: service.validationNotes,
          secondaryDevice: service.secondaryDevice,
          validatedBy: service.validatedBy || "Importação",
          validatedAt: this.#parseDate(service.validatedAt) || new Date(),
          status: this.#normalizeStatus(service.status) || "concluido",
          source: "import"
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: "Erros de validação",
          details: errors.slice(0, 20)
        });
      }

      await getClientModel();
      await getProductModel();
      const Service = await getServiceModel();
      const created = await Service.insertMany(processedServices, { ordered: false });

      return res.status(201).json({
        success: true,
        count: created.length,
        message: `${created.length} serviço(s) importado(s) com sucesso`
      });

    } catch (error) {
      if (error.name === "MongoBulkWriteError") {
        return res.status(400).json({
          error: "Alguns registros falharam",
          details: error.writeErrors?.map(e => e.errmsg).slice(0, 10)
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  //list com filtros de vin, plate, deviceId, status, serviceType e client, com paginação

  async list(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Service = await getServiceModel();

      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const skip  = (page - 1) * limit;

      const filter = this.#buildFilter(req.query);

      const [data, total] = await Promise.all([
        Service.find(filter)
          .populate("client", "name")
          .populate("product", "name")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Service.countDocuments(filter),
      ]);

      return res.json({
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
      return res.status(500).json({ error: error.message });
    }
  }



  async findById(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Service = await getServiceModel();

      const service = await Service.findById(req.params.id)
        .populate("client")
        .populate("product")
        .populate("schedule");

      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }

      return res.json(service);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const forbiddenFields = ["schedule", "source", "validatedAt"];
      forbiddenFields.forEach(field => delete req.body[field]);

      await getClientModel();
      await getProductModel();
      const Service = await getServiceModel();

      const service = await Service.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }

      return res.json(service);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async remove(req, res) {
    try {
      const Service = await getServiceModel();

      const service = await Service.findByIdAndDelete(req.params.id);

      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }

      return res.json({ message: "Serviço removido com sucesso" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  //helpers

  #buildFilter(query) {
    const filter = {};

    // Busca por VIN, plate ou deviceId (case-insensitive)
    if (query.search) {
      const regex = new RegExp(query.search, "i");
      filter.$or = [
        { vin: regex },
        { plate: regex },
        { deviceId: regex },
      ];
    }

    if (query.status) filter.status = query.status;
    if (query.serviceType) filter.serviceType = query.serviceType;
    if (query.client) filter.client = query.client;

    return filter;
  }

  #validateService(service, lineNum) {
    const errors = [];
    const required = {
      vin: "Chassi",
      model: "Modelo",
      serviceType: "Tipo de serviço",
      client: "Cliente",
      deviceId: "ID do dispositivo",
      product: "Produto",
      status: "Status",
    };

    Object.entries(required).forEach(([field, label]) => {
      if (!service[field]) {
        errors.push(`Linha ${lineNum}: ${label} obrigatório`);
      }
    });

    return { errors };
  }

  async #resolveClient(clientInput, cache) {
    if (cache.has(clientInput)) return cache.get(clientInput);

    const Client = await getClientModel();

    try {
      const client = await Client.findById(clientInput);
      if (client) {
        cache.set(clientInput, client._id);
        return client._id;
      }
    } catch {
      // não é ObjectId, segue para busca por nome
    }

    const client = await Client.findOne({
      name: { $regex: new RegExp(clientInput, "i") }
    });

    const result = client?._id ?? null;
    cache.set(clientInput, result);
    return result;
  }

  async #resolveProduct(productInput, cache) {
    if (cache.has(productInput)) return cache.get(productInput);

    const Product = await getProductModel();

    try {
      const product = await Product.findById(productInput);
      if (product) {
        cache.set(productInput, product._id);
        return product._id;
      }
    } catch {
      // não é ObjectId, segue para busca por nome
    }

    const product = await Product.findOne({
      name: { $regex: new RegExp(productInput, "i") }
    });

    const result = product?._id ?? null;
    cache.set(productInput, result);
    return result;
  }

  #normalizeServiceType(type) {
    if (!type) return null;
    const n = type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (n.includes("instal")) return "installation";
    if (n.includes("manut"))  return "maintenance";
    if (n.includes("remo"))   return "removal";
    return null;
  }

  #normalizeStatus(status) {
    if (!status) return null;
    const n = status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (n.includes("conclu"))  return "concluido";
    if (n.includes("observ"))  return "observacao";
    if (n.includes("cancel"))  return "cancelado";
    return status;
  }

  #parseDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;

    if (typeof dateValue === "number") {
      return new Date((dateValue - 25569) * 86400 * 1000);
    }

    if (typeof dateValue === "string") {
      const iso = new Date(dateValue);
      if (!isNaN(iso)) return iso;

      const parts = dateValue.split("/");
      if (parts.length === 3) {
        const [day, month, year] = parts.map(Number);
        const d = new Date(year, month - 1, day);
        if (!isNaN(d)) return d;
      }
    }

    return null;
  }
}

export default new ServiceController();