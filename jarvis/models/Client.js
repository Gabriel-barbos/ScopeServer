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

let Client;

export const initClientModel = async () => {
  if (Client) return Client;

  const conn = await getJarvisDB();

  Client = conn.models.Client || conn.model("Client", ClientSchema);
  return Client;
};
