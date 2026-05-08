import mongoose from "mongoose";
import { getJarvisDB } from "../../config/databases.js";

const PollExecutionSchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date },

    // 'cron' = execução automática | 'manual' = trigger via API
    trigger: {
      type: String,
      enum: ["cron", "manual"],
      default: "manual",
    },

    // 'running' | 'completed' | 'failed'
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
    },

    totalScanned: { type: Number, default: 0 },
    totalPolled: { type: Number, default: 0 },
    totalSkipped: { type: Number, default: 0 },
    totalNewMaintenance: { type: Number, default: 0 },
    totalRecovered: { type: Number, default: 0 },
    totalErrors: { type: Number, default: 0 },

    tokenRefreshCount: { type: Number, default: 0 },
    pagesProcessed: { type: Number, default: 0 },

    error: { type: String },
  },
  { timestamps: true }
);

let PollExecution = null;

const getPollExecutionModel = async () => {
  if (PollExecution) return PollExecution;

  const db = await getJarvisDB();
  PollExecution =
    db.models.PollExecution ||
    db.model("PollExecution", PollExecutionSchema);
  return PollExecution;
};

export default getPollExecutionModel;
