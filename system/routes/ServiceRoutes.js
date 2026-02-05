import { Router } from "express";
import ServiceController from "../controllers/ServiceController.js";

const router = Router();

router.post("/", ServiceController.create);
router.post("/from-validation", ServiceController.createFromValidation);
router.post("/bulk-import", ServiceController.bulkImport);
router.get("/", ServiceController.list);
router.get("/:id", ServiceController.findById);
router.put("/:id", ServiceController.update);
router.delete("/:id", ServiceController.remove);

export default router;
