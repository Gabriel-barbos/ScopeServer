import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    plate: { type: String },
    vin: { type: String, required: true, index: true },
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

export default mongoose.model("Service", ServiceSchema);