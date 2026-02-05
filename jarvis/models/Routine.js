import mongoose from "mongoose";
import getClientModel, { jarvisDB as sharedDB } from "./Client.js"; 

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

let Routine = null;

const getRoutineModel = async () => {
  if (Routine) return Routine;

  //  Garante que Client está registrado PRIMEIRO
  await getClientModel();

  // Usa o MESMO database que Client usa
  const db = sharedDB;
  
  Routine = db.models.Routine || db.model("Routine", RoutineSchema);
  return Routine;
};

export default getRoutineModel;