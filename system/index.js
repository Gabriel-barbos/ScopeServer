import { Router } from "express";

import productRoutes from "./routes/productRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import userController from "./controllers/UserController.js";
import ServiceRoutes from "./routes/ServiceRoutes.js";
import ReportRoutes from "./routes/ReportRoutes.js";
import ScheduleRoutes from "./routes/ScheduleRoutes.js";

const router = Router();

router.use("/users", userController);
router.use("/products", productRoutes);
router.use("/clients", clientRoutes);
router.use("/schedules", ScheduleRoutes);
router.use("/services", ServiceRoutes);
router.use("/reports", ReportRoutes);

export default router;
