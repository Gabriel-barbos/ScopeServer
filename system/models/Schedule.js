import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const ScheduleSchema = new mongoose.Schema(
  {
    maintenanceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaintenanceRequest",
      required: false,
    },

    ticketNumber: { type: String },
    subject:      { type: String },
    description:  { type: String },
    category:     { type: String },

    plate: { type: String },
    vin:   { type: String },
    model: { type: String },

    scheduledDate: { type: Date },
    serviceType:   { type: String, required: true },
    notes:         { type: String },

    createdBy: { type: String },

    responsible:      { type: String },
    responsiblePhone: { type: String },

    condutor: { type: String },

    provider:    { type: String },
    orderNumber: { type: String },

    serviceAddress:  { type: String },
    serviceLocation: { type: String },
    orderDate:       { type: Date },

    situation: { type: String },
    source:    { type: String, default: "manual" },

    vehicleGroup: { type: String },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: function () {
        return this.serviceType === "installation";
      },
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    status: {
      type: String,
      enum: ["criado", "agendado", "concluido", "atrasado", "cancelado", "frustrado"],
      default: "criado",
    },
  },
  { timestamps: true }
);

ScheduleSchema.index({ vin: 1 });
ScheduleSchema.index({ plate: 1 });
ScheduleSchema.index({ createdAt: -1 });
ScheduleSchema.index({ maintenanceRequest: 1 });

let Schedule = null;

const getScheduleModel = async () => {
  if (Schedule) return Schedule;
  const systemDB = await getSystemDB();
  Schedule = systemDB.models.Schedule || systemDB.model("Schedule", ScheduleSchema);
  return Schedule;
};

export default getScheduleModel;