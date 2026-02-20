import { Router } from "express";

import productRoutes from "./routes/ProductRoutes.js";
import clientRoutes from "./routes/ClientRoutes.js";
import userController from "./controllers/UserController.js";
import ServiceRoutes from "./routes/ServiceRoutes.js";
import ReportRoutes from "./routes/ReportRoutes.js";
import ScheduleRoutes from "./routes/ScheduleRoutes.js";
import ZohoRoutes from "./routes/Zoho.js";

const router = Router();

router.use("/users", userController);
router.use("/products", productRoutes);
router.use("/clients", clientRoutes);
router.use("/schedules", ScheduleRoutes);
router.use("/services", ServiceRoutes);
router.use("/reports", ReportRoutes);
router.use("/maintenance", ZohoRoutes);
export default router;
