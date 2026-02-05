import mongoose from "mongoose";

let systemDB;

export const connectSystemDB = async () => {
  if (systemDB) return systemDB;

  systemDB = await mongoose.createConnection(
    process.env.MONGO_URI,
    { dbName: "system" }
  );

  console.log("🟢 Mongo SYSTEM conectado");
  return systemDB;
};

export const getSystemDB = () => systemDB;
