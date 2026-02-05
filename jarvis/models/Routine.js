import mongoose from "mongoose";
import { getJarvisDB } from "../../config/databases.js";


const RoutineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    addVehicleToGroup: { type: Boolean, default: false },
    vehicleGroup: { type: String, default: null },
    shareVehicle: { type: Boolean, default: false },
    clientIdentificator: { type: String, required: true, trim: true },
    groupIdentificator: { type: String },
    shareGroup: { type: String, default: null },
  },
  { timestamps: true }
);

let Routine;

export const initRoutineModel = async () => {
  if (Routine) return Routine;

  const conn = await getJarvisDB();
  Routine = conn.models.Routine || conn.model("Routine", RoutineSchema);
  return Routine;
};
