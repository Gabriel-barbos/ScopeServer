import dns from "node:dns/promises";
import dotenv from "dotenv";

//configura o DNS ANTES de carregar qualquer módulo que possa fazer requisições de rede
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(` API Central rodando na porta ${PORT}`);
  });
} catch (err) {
  console.error(" Erro ao inicializar:", err);
  process.exit(1);
}