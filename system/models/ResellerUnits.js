import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const ResellerUnitsSchema = new mongoose.Schema(
  {
    unit_number: { type: String },
    old_reseller: { type: String },
    new_reseller: { type: String },
    status: { type: String },
    askedBy: { type: String },
  },
  { timestamps: true }
);

let ResellerUnits = null;

const getResellerUnitsModel = async () => {
  if (ResellerUnits) return ResellerUnits;
  const systemDB = await getSystemDB();
  ResellerUnits = systemDB.models.ResellerUnits || systemDB.model("ResellerUnits", ResellerUnitsSchema);
  return ResellerUnits;
};

export default getResellerUnitsModel;