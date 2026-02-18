import { Router } from "express";
import getMaintenanceRequestModel from "../models/MaintenanceRequest.js";
import getScheduleModel from "../models/Schedule.js"; // assumindo que você tem

const router = Router();

// POST - Recebe do Zoho (já existente)
router.post("/from-zoho", async (req, res) => {
  try {
    let data;

    if (typeof req.body === "string") {
      try {
        data = JSON.parse(req.body);
      } catch (e) {
        data = {};
      }
    } else {
      data = req.body || {};
    }

    const MaintenanceRequest = await getMaintenanceRequestModel();

    const {
      ticketId,
      ticketNumber,
      subject,
      description,
      contactName,
      contactEmail,
      status,
      category
    } = data;

    if (!ticketId) {
      return res.status(400).json({ error: "ticketId is required" });
    }

    const existing = await MaintenanceRequest.findOne({ ticketId });
    if (existing) {
      return res.status(200).json({ message: "Maintenance already exists" });
    }

    const maintenance = new MaintenanceRequest({
      ticketId,
      ticketNumber,
      subject,
      description,
      contactName,
      contactEmail,
      status,
      category,
      vehicles: [] // inicia vazio
    });

    await maintenance.save();
    res.status(201).json({ message: "Maintenance request created" });

  } catch (error) {
    console.error("Zoho webhook error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// GET - Webhook health check
router.get("/from-zoho", (req, res) => {
  res.status(200).json({ message: "Webhook endpoint active" });
});

// GET - Listar todas
router.get("/", async (req, res) => {
  try {
    const MaintenanceRequest = await getMaintenanceRequestModel();

    const { 
      status, 
      schedulingStatus, 
      category,
      page = 1, 
      limit = 20 
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (schedulingStatus) filters.schedulingStatus = schedulingStatus;
    if (category) filters.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [maintenances, total] = await Promise.all([
      MaintenanceRequest.find(filters)
        .populate('client', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      MaintenanceRequest.countDocuments(filters)
    ]);

    res.json({
      data: maintenances,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Get all maintenances error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// GET - Buscar uma específica
router.get("/:id", async (req, res) => {
  try {
    const MaintenanceRequest = await getMaintenanceRequestModel();
    const maintenance = await MaintenanceRequest.findById(req.params.id)
      .populate('client', 'name')
      .populate('schedules');

    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json(maintenance);

  } catch (error) {
    console.error("Get maintenance by ID error:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH - Atualizar request (subject, schedulingStatus, vehicles)
router.patch("/:id", async (req, res) => {
  try {
    const MaintenanceRequest = await getMaintenanceRequestModel();
    const { subject, schedulingStatus, vehicles, client } = req.body;

    const updateData = {};
    if (subject) updateData.subject = subject;
    if (schedulingStatus) updateData.schedulingStatus = schedulingStatus;
    if (vehicles) updateData.vehicles = vehicles;
    if (client) updateData.client = client;

    const maintenance = await MaintenanceRequest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('client', 'name');

    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json(maintenance);

  } catch (error) {
    console.error("Update maintenance error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// POST - Criar schedules a partir do request
router.post("/:id/create-schedules", async (req, res) => {
  try {
    const MaintenanceRequest = await getMaintenanceRequestModel();
    const Schedule = await getScheduleModel();

    const maintenance = await MaintenanceRequest.findById(req.params.id);

    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    // Validações
    if (!maintenance.client) {
      return res.status(400).json({ error: "Client is required to create schedules" });
    }

    if (!maintenance.vehicles || maintenance.vehicles.length === 0) {
      return res.status(400).json({ error: "At least one vehicle is required" });
    }

    // Valida cada veículo
    for (const vehicle of maintenance.vehicles) {
      if (!vehicle.plate && !vehicle.vin) {
        return res.status(400).json({ 
          error: "Each vehicle must have either plate or VIN (chassi)" 
        });
      }
      if (!vehicle.serviceAddress) {
        return res.status(400).json({ error: "Service address is required for all vehicles" });
      }
      if (!vehicle.responsible) {
        return res.status(400).json({ error: "Responsible is required for all vehicles" });
      }
      if (!vehicle.responsiblePhone) {
        return res.status(400).json({ error: "Responsible phone is required for all vehicles" });
      }
    }

    // Cria um Schedule para cada veículo
    const createdSchedules = [];

    for (const vehicle of maintenance.vehicles) {
      const schedule = new Schedule({
        maintenanceRequest: maintenance._id,
        client: maintenance.client,
        ticketNumber: maintenance.ticketNumber,
        subject: maintenance.subject,
        description: maintenance.description,
        category: maintenance.category,
        plate: vehicle.plate,
        vin: vehicle.vin,
        serviceAddress: vehicle.serviceAddress, // corrigido
        responsible: vehicle.responsible,
        responsiblePhone: vehicle.responsiblePhone,
        serviceType: "maintenance", // ou o que fizer sentido no seu sistema
        source: "zoho",
        status: "criado",
      });

      await schedule.save();
      createdSchedules.push(schedule._id);
    }

    // Atualiza o request
    maintenance.schedules = createdSchedules;
    maintenance.schedulingStatus = "completed";
    await maintenance.save();

    res.status(201).json({
      message: `${createdSchedules.length} schedule(s) created successfully`,
      schedulesCreated: createdSchedules.length,
      scheduleIds: createdSchedules
    });

  } catch (error) {
    console.error("Create schedules error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE - Remover request
router.delete("/:id", async (req, res) => {
  try {
    const MaintenanceRequest = await getMaintenanceRequestModel();
    const maintenance = await MaintenanceRequest.findByIdAndDelete(req.params.id);

    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json({ 
      message: "Maintenance request deleted successfully",
      deletedId: req.params.id 
    });

  } catch (error) {
    console.error("Delete maintenance error:", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;