import express from "express";

import clientRoutes from "./routes/ClientRoutes.js";
import routineRoutes from "./routes/RoutineRoutes.js";
import engineRoutes from "./routes/EngineRoutes.js";
import tokenRoutes from "./routes/TokenRoutes.js";
import proxyRoutes from "./routes/ProxyRoutes.js";
import pollRoutes from "./routes/PollRoutes.js";
import registerPollCron from "./jobs/PollCron.js";

const app = express();

app.use("/clients", clientRoutes);
app.use("/routines", routineRoutes);
app.use("/", engineRoutes);
app.use("/", tokenRoutes);
app.use("/", proxyRoutes);
app.use("/poll", pollRoutes);

// Registra cron job do Auto Poll 72h
registerPollCron();

export default app;
