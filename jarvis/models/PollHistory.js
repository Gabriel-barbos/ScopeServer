import mongoose from "mongoose";
import { getJarvisDB } from "../../config/databases.js";

const AttemptSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now },
    success: { type: Boolean, required: true },
    httpStatus: { type: Number },
    error: { type: String },
  },
  { _id: false }
);

const PollHistorySchema = new mongoose.Schema(
  {
    vehicleId: { type: String, required: true, index: true },
    vin: { type: String },
    description: { type: String },

    attempts: [AttemptSchema],
    totalAttempts: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "recovered", "maintenance", "ignored"],
      default: "pending",
      index: true,
    },

    lastPollDate: { type: Date },
    lastSeenOffline: { type: Date },
    flaggedAt: { type: Date },
    ignoredAt: { type: Date },
    ignoredReason: { type: String },
    lastMaintenanceRevalidatedAt: { type: Date },

    // Data em que o veículo foi confirmado como recuperado via verificação da API
    recoveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PollHistorySchema.index({ status: 1, totalAttempts: 1 });

let PollHistory = null;

const getPollHistoryModel = async () => {
  if (PollHistory) return PollHistory;

  const db = await getJarvisDB();
  PollHistory =
    db.models.PollHistory || db.model("PollHistory", PollHistorySchema);
  return PollHistory;
};

export default getPollHistoryModel;
