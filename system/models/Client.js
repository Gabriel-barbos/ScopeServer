import mongoose from "mongoose";
import { getSystemDB } from "../db.js";

const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: [String], required: true },
    description: { type: String, required: true },
    type: { type: String, default: "padrão" },
  },
  { timestamps: true }
);

export default () => {
  const conn = getSystemDB();

  if (!conn.models.Client) {
    conn.model("Client", ClientSchema);
  }

  return conn.models.Client;
};
