  import getServiceModel from "../models/Service.js";
import getServiceLegacyModel from "../models/ServiceLegacy.js";
import getScheduleModel from "../models/Schedule.js";
import getClientModel from "../models/Client.js";
import getProductModel from "../models/Product.js";

class ServiceController {
  constructor() {
    this.createFromValidation = this.createFromValidation.bind(this);
    this.create               = this.create.bind(this);
    this.bulkImport           = this.bulkImport.bind(this);
    this.bulkValidation       = this.bulkValidation.bind(this);
    this.resolveVins          = this.resolveVins.bind(this);
    this.list                 = this.list.bind(this);
    this.findById             = this.findById.bind(this);
    this.update               = this.update.bind(this);
    this.remove               = this.remove.bind(this);
  }

async createFromValidation(req, res) {
  try {
    const { scheduleId, validationData } = req.body;

    await getClientModel();
    await getProductModel();
    const Schedule = await getScheduleModel();
    const Service  = await getServiceModel();

    const schedule = await Schedule.findById(scheduleId)
      .populate("client")
      .populate("product");

    if (!schedule) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    const service = await Service.create({
      //campos herdados do Schedule
      vin:                schedule.vin,
      plate:              schedule.plate,
      model:              schedule.model,
      scheduledDate:      schedule.scheduledDate,
      serviceType:        schedule.serviceType,
      notes:              schedule.notes,
      createdBy:          schedule.createdBy,
      client:             schedule.client._id ?? schedule.client,
      product:            validationData.product || schedule.product?._id || schedule.product,
      provider:           schedule.provider,
      serviceAddress:     schedule.serviceAddress,
      serviceLocation:    schedule.serviceLocation,
      orderNumber:        schedule.orderNumber,
      orderDate:          schedule.orderDate,
      responsible:        schedule.responsible,
      responsiblePhone:   schedule.responsiblePhone,
      condutor:           schedule.condutor,
      vehicleGroup:       schedule.vehicleGroup,
      reason:             schedule.reason,
      situation:          schedule.situation,
      ticketNumber:       schedule.ticketNumber,
      subject:            schedule.subject,
      description:        schedule.description,
      category:           schedule.category,
      maintenanceRequest: schedule.maintenanceRequest,

      //dados da validação
      plate:                validationData.plate || schedule.plate,
      deviceId:             validationData.deviceId,
      technician:           validationData.technician,
      installationLocation: validationData.installationLocation,
      odometer:             validationData.odometer,
      blockingEnabled:      validationData.blockingEnabled ?? true,
      protocolNumber:       validationData.protocolNumber,
      validationNotes:      validationData.validationNotes,
      secondaryDevice:      validationData.secondaryDevice,
      validatedBy:          validationData.validatedBy,
      validatedAt:          new Date(),
      status:               "concluido",
      source:               "validation",
      schedule:             scheduleId,
    });

    await Schedule.findByIdAndDelete(scheduleId);

    return res.status(201).json(service);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
  // Bulk Validation

  async bulkValidation(req, res) {
    try {
      const { items, validatedBy: globalValidatedBy } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Envie um array de itens para validação" });
      }
      if (items.length > 200) {
        return res.status(400).json({ error: "Limite de 200 itens por operação em lote" });
      }

      await getClientModel();
      const productsCache = new Map();
      const Schedule      = await getScheduleModel();
      const Service       = await getServiceModel();

      const results = {
        created: [],
        skipped: [],
        errors:  [],
      };

      for (let i = 0; i < items.length; i++) {
        const item    = items[i];
        const lineNum = i + 1;
        const vin     = item.vin?.toString().trim();

        if (!vin) {
          results.errors.push({ line: lineNum, vin: null, error: "Chassi ausente" });
          continue;
        }

        try {
          // 1. Localiza o agendamento pelo VIN (case-insensitive)
          const schedule = await Schedule
            .findOne({ vin: new RegExp(`^${vin}$`, "i") })
            .populate("client")
            .populate("product");

          if (!schedule) {
            results.skipped.push({ line: lineNum, vin, reason: "Agendamento não encontrado" });
            continue;
          }

          const vd = item.validationData || {};

          // 2. Resolve produto
          let resolvedProduct = schedule.product?._id ?? schedule.product ?? null;
          if (vd.product) {
            const overriddenProduct = await this.#resolveProduct(vd.product, productsCache);
            if (!overriddenProduct) {
              results.errors.push({
                line: lineNum,
                vin,
                error: `Produto "${vd.product}" não encontrado`,
              });
              continue;
            }
            resolvedProduct = overriddenProduct;
          }

          // 3. Cria o Service
          const service = await Service.create({
            // campos herdados do Schedule
            vin:                schedule.vin,
            model:              schedule.model,
            scheduledDate:      schedule.scheduledDate,
            serviceType:        schedule.serviceType,
            notes:              schedule.notes,
            createdBy:          schedule.createdBy,
            client:             schedule.client._id ?? schedule.client,
            provider:           schedule.provider,
            serviceAddress:     schedule.serviceAddress,
            serviceLocation:    schedule.serviceLocation,
            orderNumber:        schedule.orderNumber,
            orderDate:          schedule.orderDate,
            responsible:        schedule.responsible,
            responsiblePhone:   schedule.responsiblePhone,
            condutor:           schedule.condutor,
            vehicleGroup:       schedule.vehicleGroup,
            reason:             schedule.reason,
            situation:          schedule.situation,
            ticketNumber:       schedule.ticketNumber,
            subject:            schedule.subject,
            description:        schedule.description,
            category:           schedule.category,
            maintenanceRequest: schedule.maintenanceRequest,

            // dados da validação 
            plate:                vd.plate                || schedule.plate,
            product:              resolvedProduct,
            deviceId:             vd.deviceId,
            technician:           vd.technician,
            installationLocation: vd.installationLocation,
            odometer:             vd.odometer             ?? null,
            blockingEnabled:      this.#parseBoolean(vd.blockingEnabled ?? true),
            protocolNumber:       vd.protocolNumber       || null,
            validationNotes:      vd.validationNotes      || null,
            secondaryDevice:      vd.secondaryDevice      || null,
            validatedBy:          vd.validatedBy          || globalValidatedBy || "Validação em lote",
            validatedAt:          this.#parseDate(vd.validatedAt) || new Date(),
            status:               "concluido",
            source:               "validation",
            schedule:             schedule._id,
          });

          // Remove o agendamento
          await Schedule.findByIdAndDelete(schedule._id);

          results.created.push({ line: lineNum, vin, serviceId: service._id });
        } catch (itemErr) {
          results.errors.push({ line: lineNum, vin, error: itemErr.message });
        }
      }

      const statusCode = results.errors.length > 0 && results.created.length === 0
        ? 400
        : results.errors.length > 0 || results.skipped.length > 0
          ? 207
          : 201;

      return res.status(statusCode).json({
        success: results.created.length > 0,
        summary: {
          total:   items.length,
          created: results.created.length,
          skipped: results.skipped.length,
          errors:  results.errors.length,
        },
        created: results.created,
        skipped: results.skipped,
        errors:  results.errors,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  
   //POST /services/resolve-vins
  
  async resolveVins(req, res) {
    try {
      const { vins } = req.body;

      if (!Array.isArray(vins) || vins.length === 0) {
        return res.status(400).json({ error: "Envie um array de VINs" });
      }
      if (vins.length > 200) {
        return res.status(400).json({ error: "Limite de 200 VINs por consulta" });
      }

      await getClientModel();
      await getProductModel();
      const Schedule = await getScheduleModel();

      // Cria regex case-insensitive para cada VIN
      const vinRegexes = vins.map((v) => new RegExp(`^${v.trim()}$`, "i"));

      const found = await Schedule
        .find({ vin: { $in: vinRegexes } })
        .select("vin model plate client product serviceType status")
        .populate("client", "name")
        .populate("product", "name")
        .lean();

      const foundMap = new Map(
        found.map((s) => [s.vin.toUpperCase(), s])
      );

      const result = vins.map((vin, idx) => {
        const schedule = foundMap.get(vin.toUpperCase()) || null;
        return {
          line:     idx + 1,
          vin:      vin.trim(),
          found:    !!schedule,
          schedule: schedule
            ? {
                id:          schedule._id,
                model:       schedule.model,
                plate:       schedule.plate,
                client:      schedule.client?.name ?? null,
                product:     schedule.product?.name ?? null,
                serviceType: schedule.serviceType,
                status:      schedule.status,
              }
            : null,
        };
      });

      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Demais métodos

  async create(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      await getScheduleModel();
      const Service = await getServiceModel();

      const service = await Service.create({
        ...req.body,
        source:      "import",
        validatedAt: new Date(),
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
      const clientsCache  = new Map();
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
          plate:                service.plate,
          vin:                  service.vin,
          model:                service.model,
          serviceType,
          client:               clientId,
          product:              productId,
          deviceId:             service.deviceId,
          technician:           service.technician,
          provider:             service.provider,
          serviceAddress:       service.serviceAddress,
          installationLocation: service.installationLocation,
          odometer:             service.odometer,
          blockingEnabled:      this.#parseBoolean(service.blockingEnabled),
          protocolNumber:       service.protocolNumber,
          validationNotes:      service.validationNotes,
          secondaryDevice:      service.secondaryDevice,
          serviceLocation:      service.serviceLocation,
          orderDate:            service.orderDate,
          validatedBy:          service.validatedBy || "Importação",
          validatedAt:          this.#parseDate(service.validatedAt) || new Date(),
          status:               this.#normalizeStatus(service.status) || "concluido",
          source:               "import",

           orderNumber:          service.orderNumber,
          orderDate:            this.#parseDate(service.orderDate),
          scheduledDate:        this.#parseDate(service.scheduledDate),
          responsible:          service.responsible,
          responsiblePhone:     service.responsiblePhone,
          condutor:             service.condutor,
          vehicleGroup:         service.vehicleGroup,
          situation:            service.situation,
          ticketNumber:         service.ticketNumber,
          subject:              service.subject,
          description:          service.description,
          category:             service.category,
          reason:               service.reason,
          notes:                service.notes,
          createdBy:            service.createdBy,
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: "Erros de validação", details: errors.slice(0, 20) });
      }

      await getClientModel();
      await getProductModel();
      const Service = await getServiceModel();
      const created = await Service.insertMany(processedServices, { ordered: false });

      return res.status(201).json({
        success: true,
        count:   created.length,
        message: `${created.length} serviço(s) importado(s) com sucesso`,
      });
    } catch (error) {
      if (error.name === "MongoBulkWriteError") {
        return res.status(400).json({
          error:   "Alguns registros falharam",
          details: error.writeErrors?.map((e) => e.errmsg).slice(0, 10),
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  async list(req, res) {
    try {
      await getClientModel();
      await getProductModel();
      const Service       = await getServiceModel();
      const ServiceLegacy = await getServiceLegacyModel();

      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const skip  = (page - 1) * limit;

      const filter = this.#buildFilter(req.query);

      const [totalMain, totalLegacy] = await Promise.all([
        Service.countDocuments(filter),
        ServiceLegacy.countDocuments(filter),
      ]);

      const total       = totalMain + totalLegacy;
      const mainSkip    = Math.min(skip, totalMain);
      const mainLimit   = Math.min(limit, Math.max(0, totalMain - mainSkip));
      const legacySkip  = Math.max(0, skip - totalMain);
      const legacyLimit = limit - mainLimit;

      const [mainData, legacyData] = await Promise.all([
        mainLimit > 0
          ? Service.find(filter)
              .populate("client", "name image")
              .populate("product", "name")
              .sort({ validatedAt: -1 })
              .skip(mainSkip)
              .limit(mainLimit)
          : [],
        legacyLimit > 0
          ? ServiceLegacy.find(filter)
              .sort({ validatedAt: -1 })
              .skip(legacySkip)
              .limit(legacyLimit)
          : [],
      ]);

      const legacyNormalized = legacyData.map((doc) => {
        const obj = doc.toObject();
        return {
          ...obj,
          client:  { _id: null, name: obj.client  ?? "—", image: [] },
          product: obj.product ? { _id: null, name: obj.product } : null,
        };
      });

      return res.json({
        data: [...mainData, ...legacyNormalized],
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

      if (!service) return res.status(404).json({ error: "Serviço não encontrado" });

      return res.json(service);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const forbiddenFields = ["schedule", "source", "validatedAt"];
      forbiddenFields.forEach((f) => delete req.body[f]);

      await getClientModel();
      await getProductModel();
      const Service = await getServiceModel();

      const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!service) return res.status(404).json({ error: "Serviço não encontrado" });

      return res.json(service);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  async remove(req, res) {
    try {
      const Service = await getServiceModel();
      const service = await Service.findByIdAndDelete(req.params.id);
      if (!service) return res.status(404).json({ error: "Serviço não encontrado" });
      return res.json({ message: "Serviço removido com sucesso" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

//helpers
  #buildFilter(query) {
    const filter = {};
    if (query.search) {
      const regex = new RegExp(query.search, "i");
      filter.$or = [{ vin: regex }, { plate: regex }, { deviceId: regex }];
    }
    if (query.status)      filter.status      = query.status;
    if (query.serviceType) filter.serviceType = query.serviceType;
    if (query.client)      filter.client      = query.client;
    return filter;
  }

  #parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["sim", "true", "1", "yes"].includes(value.toLowerCase());
  }
  return true; // default
}

  #validateService(service, lineNum) {
    const errors = [];
    const required = {
      vin:         "Chassi",
      model:       "Modelo",
      serviceType: "Tipo de serviço",
      client:      "Cliente",
      deviceId:    "ID do dispositivo",
      product:     "Produto",
      status:      "Status",
    };
    Object.entries(required).forEach(([field, label]) => {
      if (!service[field]) errors.push(`Linha ${lineNum}: ${label} obrigatório`);
    });
    return { errors };
  }

  async #resolveClient(clientInput, cache) {
    if (cache.has(clientInput)) return cache.get(clientInput);
    const Client = await getClientModel();
    try {
      const client = await Client.findById(clientInput);
      if (client) { cache.set(clientInput, client._id); return client._id; }
    } catch { /* não é ObjectId */ }
    const client = await Client.findOne({ name: { $regex: new RegExp(clientInput, "i") } });
    const result = client?._id ?? null;
    cache.set(clientInput, result);
    return result;
  }

  async #resolveProduct(productInput, cache) {
    if (cache.has(productInput)) return cache.get(productInput);
    const Product = await getProductModel();
    try {
      const product = await Product.findById(productInput);
      if (product) { cache.set(productInput, product._id); return product._id; }
    } catch { /* não é ObjectId */ }
    const product = await Product.findOne({ name: { $regex: new RegExp(productInput, "i") } });
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
    if (n.includes("conclu")) return "concluido";
    if (n.includes("observ")) return "observacao";
    if (n.includes("cancel")) return "cancelado";
    return status;
  }

  #parseDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === "number") return new Date((dateValue - 25569) * 86400 * 1000);
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