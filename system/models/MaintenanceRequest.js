import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const maintenanceRequestSchema = new mongoose.Schema(
  {
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
    status: String, 
    category: String,
    source: {
      type: String,
      default: "zoho"
    },

    schedulingStatus: {
      type: String,
      enum: ["pending", "waiting_address", "waiting_responsible", "completed", "cancelled"],
      default: "pending"
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: false,
    },

    // Array de veículos
    vehicles: [{
      plate: { type: String, required: false },
      vin: { type: String, required: false }, // chassi
      serviceAddress: { type: String, required: false },
      responsible: { type: String, required: false },
      responsiblePhone: { type: String, required: false }
    }],

    // Referências aos Schedules 
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