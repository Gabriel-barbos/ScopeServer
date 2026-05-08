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

    // 'pending' = recebeu poll, aguardando retorno
    // 'recovered' = voltou a comunicar após poll
    // 'maintenance' = 3 polls sem retorno, precisa manutenção
    status: {
      type: String,
      enum: ["pending", "recovered", "maintenance"],
      default: "pending",
      index: true,
    },

    lastPollDate: { type: Date },
    lastSeenOffline: { type: Date },
    flaggedAt: { type: Date },
  },
  { timestamps: true }
);

// Index composto para busca eficiente
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
