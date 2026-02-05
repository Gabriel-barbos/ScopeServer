import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import jarvisApp from "./jarvis/index.js";
import { getJarvisDB, getNfDB, getSystemDB } from "./config/databases.js"

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

(async () => {
  try {
    await Promise.all([
      getJarvisDB(),
      getNfDB(),
      getSystemDB(),
    ]);

    app.listen(PORT, () => {
      console.log(`Mongo acionado ${PORT}`);
    });
  } catch (err) {
    console.error("Erro ao conectar Mongo:", err);
    process.exit(1);
  }
})();

app.use("/api/jarvis", jarvisApp);
// futuramente:
// app.use("/api/nf", nfApp);
// app.use("/api/system", systemApp);

app.get("/api/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Central rodando na porta ${PORT}`);
});
