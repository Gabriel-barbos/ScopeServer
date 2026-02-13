import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const ServiceSchema = new mongoose.Schema(
  {
    plate: { type: String },
    vin: { type: String, required: true },
    model: { type: String, required: true },
    scheduledDate: { type: Date },
    serviceType: {
      type: String,
      required: true,
      enum: ["installation", "maintenance", "removal"]
    },
    notes: { type: String },
    createdBy: { type: String },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true
    },
    deviceId: { type: String, required: true },
    technician: { type: String, required: true },
    provider: { type: String },
    installationLocation: { type: String, required: true },
    serviceAddress: { type: String, required: true },
    odometer: { type: Number },
    blockingEnabled: { type: Boolean, default: true },
    protocolNumber: { type: String },
    validationNotes: { type: String },
    secondaryDevice: { type: String },
    validatedBy: { type: String },
    status: {
      type: String,
      default: "concluido"
    },
    validatedAt: { type: Date, default: Date.now },
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule"
    },
    source: {
      type: String,
      enum: ["validation", "import"],
      default: "validation"
    }
  },
  { timestamps: true }
);

ServiceSchema.index({ vin: 1 });
ServiceSchema.index({ deviceId: 1 });
ServiceSchema.index({ plate: 1 });
ServiceSchema.index({ createdAt: -1 });

let Service = null;

const getServiceModel = async () => {
  if (Service) return Service;

  const systemDB = await getSystemDB();
  Service = systemDB.models.Service || systemDB.model("Service", ServiceSchema);
  return Service;
};

export default getServiceModel;