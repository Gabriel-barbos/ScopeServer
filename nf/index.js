import express from "express";
import destinatarioRoutes from "./routes/destinatarios.js";
import zohoRoutes from "./services/zoho.js";
import notaRoutes from "./routes/notas.js";
import testNuvemFiscalRoutes from "./routes/testeNuvemFiscal.js";

const app = express();


// Rotas
app.use("/destinatarios", destinatarioRoutes);
app.use("/zoho", zohoRoutes);
app.use("/nota", notaRoutes);
app.use("/test-nuvemfiscal", testNuvemFiscalRoutes);

// Rota de teste
app.get("/", (req, res) => res.send("API NF funcionando 🟢"));

export default app;