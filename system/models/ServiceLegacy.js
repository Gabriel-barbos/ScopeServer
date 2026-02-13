import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const ServiceLegacySchema = new mongoose.Schema(
  {
    plate: { type: String },
    vin: { type: String, required: true },
    model: { type: String, required: true },
    scheduledDate: { type: Date },
    serviceType: {
      type: String,
      enum: ["installation", "maintenance", "removal"],
      required: true,
    },
    notes: { type: String },
    createdBy: { type: String },
    client: { type: String },
    product: { type: String },
    deviceId: { type: String },
    technician: { type: String },
    provider: { type: String },
    installationLocation: { type: String },
    serviceAddress: { type: String },
    odometer: { type: Number },
    blockingEnabled: { type: Boolean },
    protocolNumber: { type: String },
    validationNotes: { type: String },
    secondaryDevice: { type: String },
    validatedBy: { type: String },
    status: { type: String },
    validatedAt: { type: Date },
    source: {
      type: String,
      default: "legacy",
      immutable: true,
    },
  },
  { timestamps: false }
);

ServiceLegacySchema.index({ vin: 1 });
ServiceLegacySchema.index({ deviceId: 1 });
ServiceLegacySchema.index({ plate: 1 });
ServiceLegacySchema.index({ validatedAt: -1 });

let ServiceLegacy = null;

const getServiceLegacyModel = async () => {
  if (ServiceLegacy) return ServiceLegacy;

  const systemDB = await getSystemDB();
  ServiceLegacy =
    systemDB.models.ServiceLegacy ||
    systemDB.model("ServiceLegacy", ServiceLegacySchema);
  return ServiceLegacy;
};

export default getServiceLegacyModel;