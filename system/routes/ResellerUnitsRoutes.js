import { Router } from "express";
import ResellerUnitsController from "../controllers/ResellerUnitsController.js";

const router = Router();

// Bulk
router.post("/bulk",          ResellerUnitsController.bulkCreate);
router.put("/bulk/status",    ResellerUnitsController.bulkUpdateStatus);
router.delete("/bulk",        ResellerUnitsController.bulkDelete);

// Summary
router.get("/summary", ResellerUnitsController.summary);

// Export
router.get("/export", ResellerUnitsController.export);

// Listagem
router.get("/",               ResellerUnitsController.list);

// Individual
router.get("/:id",            ResellerUnitsController.findById);
router.put("/:id",            ResellerUnitsController.updateOne);
router.delete("/:id",         ResellerUnitsController.deleteOne);

export default router;