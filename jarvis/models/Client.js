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

// Inicializa o model uma vez
let Client;
let dbPromise;

const getClientModel = async () => {
  if (Client) return Client;
  
  if (!dbPromise) {
    dbPromise = getJarvisDB();
  }
  
  const db = await dbPromise;
  Client = db.models.Client || db.model("Client", ClientSchema);
  return Client;
};

export default getClientModel;