import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image: { type: [String], default: [] },
    description: { type: String },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
  },
  { timestamps: true }
);

ClientSchema.virtual("isSubclient").get(function () {
  return this.parent !== null;
});

ClientSchema.index({ parent: 1 });

let Client = null;

const getClientModel = async () => {
  if (Client) return Client;
  const systemDB = await getSystemDB();
  Client = systemDB.models.Client || systemDB.model("Client", ClientSchema);
  return Client;
};

export default getClientModel;