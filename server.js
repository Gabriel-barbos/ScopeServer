
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import jarvisApp from "./jarvis/index.js";
import nfApp from "./nf/index.js";
import systemApp from "./system/index.js"; 

import { getJarvisDB, getNfDB, getSystemDB } from "./config/databases.js";
import { initializeModels } from "./system/models/index.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

(async () => {
  try {
    await Promise.all([
      getJarvisDB(),
      getNfDB(),
      getSystemDB(),
    ]);

    // Inicializa os models
    await initializeModels();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`API Central rodando na porta ${PORT}`);
    });
  } catch (err) {
    console.error("Erro ao inicializar:", err);
    process.exit(1);
  }
})();

app.use("/api/jarvis", jarvisApp);
app.use("/api/nf", nfApp);
app.use("/api/system", systemApp);

app.get("/api/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});