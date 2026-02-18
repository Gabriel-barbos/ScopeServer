import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const maintenanceRequestSchema = new mongoose.Schema(
  {
    // Dados do Zoho (imutáveis)
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    ticketNumber: String,
    subject: String,
    description: String,
    contactName: String,
    contactEmail: String,
    status: String, // Status do ticket no Zoho
    category: String,
    source: {
      type: String,
      default: "zoho"
    },

    // Status do fluxo de agendamento
    schedulingStatus: {
      type: String,
      enum: ["pending", "waiting_address", "waiting_responsible", "completed", "cancelled"],
      default: "pending"
    },

    // Dados coletados para criar os Schedules
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: false,
    },

    // Array de veículos (cada um virará um Schedule)
    vehicles: [{
      plate: { type: String, required: false },
      vin: { type: String, required: false }, // chassi
      serviceAddress: { type: String, required: false },
      responsible: { type: String, required: false },
      responsiblePhone: { type: String, required: false }
    }],

    // Referências aos Schedules criados
    schedules: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule"
    }]
  },
  { timestamps: true }
);

let MaintenanceRequest = null;

const getMaintenanceRequestModel = async () => {
  if (MaintenanceRequest) {
    return MaintenanceRequest;
  }

  const systemDB = await getSystemDB();

  MaintenanceRequest =
    systemDB.models.MaintenanceRequest ||
    systemDB.model("MaintenanceRequest", maintenanceRequestSchema);

  return MaintenanceRequest;
};

export default getMaintenanceRequestModel;