
import mongoose from "mongoose";

let connection;
let jarvisDB;
let nfDB;
let systemDB;

const connectMongo = async () => {
  if (!connection) {
    connection = mongoose.createConnection(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    await connection.asPromise();

    console.log("🟢 MongoDB cluster conectado");
  }

  return connection;
};

export const getJarvisDB = async () => {
  if (jarvisDB) return jarvisDB;
  
  const conn = await connectMongo();
  jarvisDB = conn.useDb("jarvis");
  
  console.log("🟢 JarvisDB inicializado");
  return jarvisDB;
};

export const getNfDB = async () => {
  if (nfDB) return nfDB;
  
  const conn = await connectMongo();
  nfDB = conn.useDb("nf");
  
  console.log("🟢 NfDB inicializado");
  return nfDB;
};

export const getSystemDB = async () => {
  if (systemDB) {
    console.log("🟢 SystemDB já inicializado ");
    return systemDB;
  }
  
  const conn = await connectMongo();
  systemDB = conn.useDb("scopebr");
  
  console.log("🟢 SystemDB inicializado");
  return systemDB;
};