import mongoose from "mongoose";
import { getJarvisDB } from "../../config/databases.js";

const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    login: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    type: { type: String, required: true },
  },
  { timestamps: true }
);

// 🔑 IMPORTANTE: Variáveis compartilhadas entre Client e Routine
export let jarvisDB = null;
export let Client = null;

const getClientModel = async () => {
  if (Client) return Client;

  if (!jarvisDB) {
    jarvisDB = await getJarvisDB();
  }

  Client = jarvisDB.models.Client || jarvisDB.model("Client", ClientSchema);
  return Client;
};

export default getClientModel;