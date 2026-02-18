import { Router } from "express";
import getMaintenanceRequestModel from "../models/MaintenanceRequest.js";

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

    console.log("Zoho payload:", JSON.stringify(data, null, 2));

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
      category
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

// GET - Listar todas as solicitações de manutenção
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

    // Monta filtros dinamicamente
    const filters = {};
    if (status) filters.status = status;
    if (schedulingStatus) filters.schedulingStatus = schedulingStatus;
    if (category) filters.category = category;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [maintenances, total] = await Promise.all([
      MaintenanceRequest.find(filters)
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

// GET - Buscar uma solicitação específica por ID
router.get("/:id", async (req, res) => {
  try {
    const MaintenanceRequest = await getMaintenanceRequestModel();
    const maintenance = await MaintenanceRequest.findById(req.params.id);

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

// PATCH - Atualizar status de agendamento
router.patch("/:id/scheduling-status", async (req, res) => {
  try {
    const MaintenanceRequest = await getMaintenanceRequestModel();
    const { schedulingStatus } = req.body;

    const validStatuses = ["pending", "scheduled", "completed", "canceled"];
    if (!validStatuses.includes(schedulingStatus)) {
      return res.status(400).json({ 
        error: "Invalid scheduling status",
        validStatuses 
      });
    }

    const maintenance = await MaintenanceRequest.findByIdAndUpdate(
      req.params.id,
      { schedulingStatus },
      { new: true, runValidators: true }
    );

    if (!maintenance) {
      return res.status(404).json({ error: "Maintenance request not found" });
    }

    res.json(maintenance);

  } catch (error) {
    console.error("Update scheduling status error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE - Remover uma solicitação
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
