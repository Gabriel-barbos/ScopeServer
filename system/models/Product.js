
import mongoose from "mongoose";
import { getSystemDB } from "../../config/databases.js";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String },
    image: [{ type: String }], 
  },
  { timestamps: true }
);

let Product = null;

const getProductModel = async () => {
  if (Product) {
    return Product;
  }
  
  const systemDB = await getSystemDB();
  
  Product = systemDB.models.Product || systemDB.model("Product", productSchema);
  
  
  return Product;
};

export default getProductModel;