import express from "express";
import cors from "cors";

import clientRoutes from "./routes/ClientRoutes.js";
import routineRoutes from "./routes/RoutineRoutes.js";
import engineRoutes from "./routes/EngineRoutes.js";
import tokenRoutes from "./routes/TokenRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/clients", clientRoutes);
app.use("/routines", routineRoutes);
app.use("/", engineRoutes);
app.use("/", tokenRoutes);

export default app;
