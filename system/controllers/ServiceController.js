import Service from "../models/Service.js";
import Schedule from "../models/Schedule.js";
import Client from "../models/Client.js";
import Product from "../models/Product.js";

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

  // Criar serviço a partir de validação
  async createFromValidation(req, res) {
    try {
      const { scheduleId, validationData } = req.body;

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

  // Criar serviço direto 
  async create(req, res) {
    try {
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

  // Importação em lote com matching de cliente e produto
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

      // Cache de clientes e produtos para otimização
      const clientsCache = new Map();
      const productsCache = new Map();

      for (let i = 0; i < services.length; i++) {
        const service = services[i];
        const lineNum = i + 1;

        // Validações obrigatórias
        const validation = this.#validateService(service, lineNum);
        if (validation.errors.length > 0) {
          errors.push(...validation.errors);
          continue;
        }

        // Resolver cliente (por ID ou nome)
        const clientId = await this.#resolveClient(service.client, clientsCache);
        if (!clientId) {
          errors.push(`Linha ${lineNum}: Cliente "${service.client}" não encontrado`);
          continue;
        }

        // Resolver produto (opcional, por ID ou nome)
        let productId = null;
        if (service.product) {
          productId = await this.#resolveProduct(service.product, productsCache);
          if (!productId) {
            errors.push(`Linha ${lineNum}: Produto "${service.product}" não encontrado`);
            continue;
          }
        }

        // Normalizar tipo de serviço
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

      // Se houver erros de validação, retornar sem inserir
      if (errors.length > 0) {
        return res.status(400).json({
          error: "Erros de validação",
          details: errors.slice(0, 20)
        });
      }

      // Inserir serviços
      const created = await Service.insertMany(processedServices, { ordered: false });

      return res.status(201).json({
        success: true,
        count: created.length,
        message: `${created.length} serviço(s) importado(s) com sucesso`
      });

    } catch (error) {
      if (error.name === 'MongoBulkWriteError') {
        return res.status(400).json({
          error: "Alguns registros falharam",
          details: error.writeErrors?.map(e => e.errmsg).slice(0, 10)
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // Listar serviços
  async list(req, res) {
    try {
      const services = await Service.find()
        .populate("client", "name image")
        .populate("product", "name")
        .sort({ createdAt: -1 });

      return res.json(services);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Buscar por ID
  async findById(req, res) {
    try {
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

  // Atualizar serviço 
  async update(req, res) {
    try {
      const forbiddenFields = ["schedule", "source", "validatedAt"];
      forbiddenFields.forEach(field => delete req.body[field]);

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

  // Excluir serviço
  async remove(req, res) {
    try {
      const service = await Service.findByIdAndDelete(req.params.id);

      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }

      return res.json({ message: "Serviço removido com sucesso" });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  //metodos auxiliares

  #validateService(service, lineNum) {
    const errors = [];
    const required = {
      vin: "Chassi",
      model: "Modelo",
      serviceType: "Tipo de serviço",
      client: "Cliente",
      deviceId: "ID do dispositivo",
      product: "Produto",
      status  : "Status",
  
    };

    Object.entries(required).forEach(([field, label]) => {
      if (!service[field]) {
        errors.push(`Linha ${lineNum}: ${label} obrigatório`);
      }
    });

    return { errors };
  }

  async #resolveClient(clientInput, cache) {
    // Se já está no cache, retorna
    if (cache.has(clientInput)) {
      return cache.get(clientInput);
    }

    // Tenta como ObjectId primeiro
    try {
      const client = await Client.findById(clientInput);
      if (client) {
        cache.set(clientInput, client._id);
        return client._id;
      }
    } catch (e) {
      // Não é um ObjectId válido, continua
    }

    // Busca por nome
    const client = await Client.findOne({
      name: { $regex: new RegExp(clientInput, "i") }
    });

    if (client) {
      cache.set(clientInput, client._id);
      return client._id;
    }

    cache.set(clientInput, null);
    return null;
  }

  async #resolveProduct(productInput, cache) {
    if (cache.has(productInput)) {
      return cache.get(productInput);
    }

    // Tenta como ObjectId
    try {
      const product = await Product.findById(productInput);
      if (product) {
        cache.set(productInput, product._id);
        return product._id;
      }
    } catch (e) {
      // Não é ObjectId
    }

    // Busca por nome
    const product = await Product.findOne({
      name: { $regex: new RegExp(productInput, "i") }
    });

    if (product) {
      cache.set(productInput, product._id);
      return product._id;
    }

    cache.set(productInput, null);
    return null;
  }

  #normalizeServiceType(type) {
    if (!type) return null;

    const normalized = type.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const mappings = {
      instal: "installation",
      manut: "maintenance",
      remo: "removal"
    };

    for (const [key, value] of Object.entries(mappings)) {
      if (normalized.includes(key)) return value;
    }

    return null;
  }

  #normalizeStatus(status) {
    if (!status) return null;

    const normalized = status.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const mappings = {
      conclu: "concluido",
      observ: "observacao",
      pendente: "pendente",
      cancel: "cancelado"
    };

    for (const [key, value] of Object.entries(mappings)) {
      if (normalized.includes(key)) return value;
    }

    return status;
  }

  #parseDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;

    // Serial do Excel 
    if (typeof dateValue === 'number') {
      return new Date((dateValue - 25569) * 86400 * 1000);
    }

    // String ISO ou formato BR
    if (typeof dateValue === 'string') {
      let date = new Date(dateValue);
      if (!isNaN(date.getTime())) return date;

      // Tenta formato DD/MM/YYYY
      const parts = dateValue.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts.map(Number);
        date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) return date;
      }
    }

    return null;
  }
}

export default new ServiceController(); 