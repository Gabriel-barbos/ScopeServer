import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const ScheduleSchema = new mongoose.Schema(
  {
    maintenanceRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaintenanceRequest",
      required: false 
    },
    
    ticketNumber: { type: String, required: false },
    subject: { type: String, required: false },
    description: { type: String, required: false },
    category: { type: String, required: false },
    
    plate: { type: String, required: false },
    vin: { type: String, required: false }, 
    model: { type: String, required: false },
    
    scheduledDate: { type: Date, required: false },
    serviceType: { type: String, required: true },
    notes: { type: String },
    createdBy: { type: String },
    provider: { type: String, required: false },
    orderNumber: { type: String, required: false },
    
    serviceAddress: { type: String, required: false }, 
    responsible: { type: String, required: false },
    responsiblePhone: { type: String, required: false },
    
    situation: { type: String, required: false },
    source: { 
      type: String, 
      required: false,
      default: "manual" 
    },
    
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
      enum: ["criado", "agendado", "concluido", "atrasado", "cancelado"],
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