import mongoose from "mongoose";

let jarvisDB;

export const connectJarvisDB = async () => {
  if (jarvisDB) return jarvisDB;

  jarvisDB = await mongoose.createConnection(
    process.env.MONGO_URI,
    { dbName: "jarvis" }
  );

  console.log("🟢 Mongo JARVIS conectado");
  return jarvisDB;
};

export const getJarvisDB = () => jarvisDB;
