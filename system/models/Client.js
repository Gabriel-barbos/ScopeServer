import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: [String], required: false },
    description: { type: String, required: false },
    type: { type: String, default: "padrão" },
  },
  { timestamps: true }
);

let Client = null;

const getClientModel = async () => {
  if (Client) return Client;
  
  const systemDB = await getSystemDB();
  Client = systemDB.models.Client || systemDB.model("Client", ClientSchema);
  return Client;
};

export default getClientModel;