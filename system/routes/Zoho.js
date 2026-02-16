import { Router } from "express";
import getMaintenanceRequestModel from "../models/MaintenanceRequest.js";

const router = Router();

router.post("/from-zoho", async (req, res) => {
  try {
    console.log("Zoho payload:", req.body);

    // Se o Deluge enviar como string JSON, faz o parse
    const data = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

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

router.get("/from-zoho", (req, res) => {
  res.status(200).json({ message: "Webhook endpoint active" });
});

export default router;
