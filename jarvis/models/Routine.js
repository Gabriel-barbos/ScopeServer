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

// Inicializa o model uma vez
let Routine;
let dbPromise;

const getRoutineModel = async () => {
  if (Routine) return Routine;
  
  if (!dbPromise) {
    dbPromise = getJarvisDB();
  }
  
  const db = await dbPromise;
  Routine = db.models.Routine || db.model("Routine", RoutineSchema);
  return Routine;
};

export default getRoutineModel;