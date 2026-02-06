import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: [String], required: true },
    description: { type: String, required: true },
    type: { type: String, default: "padrão" },
  },
  { timestamps: true }
);

let systemDB = null;
let Client = null;

const getClientModel = async () => {
  if (Client) return Client;
  
  if (!systemDB) {
    systemDB = await getSystemDB();
  }
  
  Client = systemDB.models.Client || systemDB.model("Client", ClientSchema);
  return Client;
};

export default getClientModel;