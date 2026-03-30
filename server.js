import dns from "node:dns/promises";
import dotenv from "dotenv";

dotenv.config();
dns.setServers(["1.1.1.1", "8.8.8.8"]);

//carrega tudo
const [
  { default: express },
  { default: cors },
  { default: jarvisApp },
  { default: nfApp },
  { default: systemApp },
  { getJarvisDB, getNfDB, getSystemDB },
  { initializeModels },
] = await Promise.all([
  import("express"),
  import("cors"),
  import("./jarvis/index.js"),
  import("./nf/index.js"),
  import("./system/index.js"),
  import("./config/databases.js"),
  import("./system/models/index.js"),
]);

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Rotas
app.use("/api/jarvis", jarvisApp);
app.use("/api/nf", nfApp);
app.use("/api/system", systemApp);

app.get("/api/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Inicialização
try {
  await Promise.all([
    getJarvisDB(),
    getNfDB(),
    getSystemDB(),
  ]);

  await initializeModels();

 app.listen(PORT, () => {
  console.log(`API Central rodando na porta ${PORT}`);
  
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[MEM] heapUsed: ${Math.round(mem.heapUsed / 1024 / 1024)}MB | heapTotal: ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
  }, 60_000);
});
} catch (err) {
  console.error(" Erro ao inicializar:", err);
  process.exit(1);
}

