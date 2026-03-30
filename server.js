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

//log de memória por rota
app.use((req, res, next) => {
  const startMem = process.memoryUsage().heapUsed;

  res.on("finish", () => {
    const endMem = process.memoryUsage().heapUsed;
    const diffMB = ((endMem - startMem) / 1024 / 1024).toFixed(2);

    // Só loga se a rota consumiu mais de 1MB (evita poluir o log)
    if (Math.abs(parseFloat(diffMB)) > 1) {
      console.log(
        `[MEM-ROUTE] ${req.method} ${req.originalUrl} | ` +
        `diff: ${parseFloat(diffMB) > 0 ? "+" : ""}${diffMB}MB | ` +
        `heap: ${Math.round(endMem / 1024 / 1024)}MB`
      );
    }
  });

  next();
});

// Rotas
app.use("/api/jarvis", jarvisApp);
app.use("/api/nf", nfApp);
app.use("/api/system", systemApp);

app.get("/api/health", (_, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(mem.external / 1024 / 1024)}MB`,
    },
  });
});

// Inicialização
try {
  await Promise.all([
    getJarvisDB(),
    getNfDB(),
    getSystemDB(),
  ]);

  await initializeModels();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API Central rodando na porta ${PORT}`);

    let lastHeap = 0;

    //log de memória a cada 30s
    setInterval(() => {
      const mem = process.memoryUsage();
      const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
      const diff = heapMB - lastHeap;

      console.log(
        `[MEM] RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | ` +
        `heap: ${heapMB}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB | ` +
        `external: ${Math.round(mem.external / 1024 / 1024)}MB | ` +
        `diff: ${diff > 0 ? "+" : ""}${diff}MB`
      );

      lastHeap = heapMB;

      if (heapMB > 200) {
        console.warn(`⚠️ [MEM CRITICAL] Heap em ${heapMB}MB - crash iminente!`);
      }
    }, 30_000);
  });
} catch (err) {
  console.error("Erro ao inicializar:", err);
  process.exit(1);
}