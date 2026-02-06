import mongoose from "mongoose";

let connection;

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
  const conn = await connectMongo();
  return conn.useDb("jarvis");
};

export const getNfDB = async () => {
  const conn = await connectMongo();
  return conn.useDb("nf");
};

export const getSystemDB = async () => {
  const conn = await connectMongo();
  return conn.useDb("scopebr");
};
