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
      enum: ["pending", "scheduled", "completed", "canceled"],
      default: "pending"
    }
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
