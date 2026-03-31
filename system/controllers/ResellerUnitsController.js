import getResellerUnitsModel from "../models/ResellerUnits.js";

const VALID_STATUSES = ["pending", "done"];
const MAX_BULK = 2000;

function buildFilter({ status, reseller, askedBy, dateFrom, dateTo }) {
  const filter = {};

  if (status)   filter.status   = status;
  if (reseller) filter.reseller = new RegExp(reseller, "i");
  if (askedBy)  filter.askedBy  = new RegExp(askedBy, "i");

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo)   filter.createdAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  return filter;
}

class ResellerUnitsController {
  constructor() {
    this.bulkCreate       = this.bulkCreate.bind(this);
    this.bulkUpdateStatus = this.bulkUpdateStatus.bind(this);
    this.bulkDelete       = this.bulkDelete.bind(this);
    this.list             = this.list.bind(this);
    this.summary          = this.summary.bind(this);
    this.findById         = this.findById.bind(this);
    this.updateOne        = this.updateOne.bind(this);
    this.deleteOne        = this.deleteOne.bind(this);
  }

  // POST /bulk
  async bulkCreate(req, res) {
    try {
      const { units } = req.body;

      if (!Array.isArray(units) || units.length === 0)
        return res.status(400).json({ error: "Envie um array em 'units'" });

      if (units.length > MAX_BULK)
        return res.status(400).json({ error: `Limite de ${MAX_BULK} unidades por operação` });

      const docs = units.map((u) => ({
        unit_number: u.unit_number,
        reseller:    u.reseller,
        askedBy:     u.askedBy,
        status:      "pending",
      }));

      const ResellerUnits = await getResellerUnitsModel();
      const result = await ResellerUnits.insertMany(docs, { ordered: false, lean: true });

      return res.status(201).json({ success: true, created: result.length });
    } catch (error) {
      if (error.name === "MongoBulkWriteError") {
        return res.status(207).json({
          success: true,
          created: error.result?.nInserted ?? 0,
          errors:  error.writeErrors?.map((e) => e.errmsg).slice(0, 10),
        });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // PUT /bulk/status
  async bulkUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;

      if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ error: "Envie um array em 'ids'" });

      if (ids.length > MAX_BULK)
        return res.status(400).json({ error: `Limite de ${MAX_BULK} IDs por operação` });

      if (!VALID_STATUSES.includes(status))
        return res.status(400).json({ error: `Status inválido. Use: ${VALID_STATUSES.join(", ")}` });

      const ResellerUnits = await getResellerUnitsModel();
      const result = await ResellerUnits.updateMany(
        { _id: { $in: ids } },
        { $set: { status } }
      );

      return res.json({ success: true, updated: result.modifiedCount });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // DELETE /bulk
  async bulkDelete(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0)
        return res.status(400).json({ error: "Envie um array em 'ids'" });

      if (ids.length > MAX_BULK)
        return res.status(400).json({ error: `Limite de ${MAX_BULK} IDs por operação` });

      const ResellerUnits = await getResellerUnitsModel();
      const result = await ResellerUnits.deleteMany({ _id: { $in: ids } });

      return res.json({ success: true, deleted: result.deletedCount });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /
  async list(req, res) {
    try {
      const page  = Math.max(1, parseInt(req.query.page)  || 1);
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
      const skip  = (page - 1) * limit;

      const filter = buildFilter(req.query);

      const ResellerUnits = await getResellerUnitsModel();

      const [data, total] = await Promise.all([
        ResellerUnits.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ResellerUnits.countDocuments(filter),
      ]);

      return res.json({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // GET /summary
async summary(req, res) {
  try {
    const ResellerUnits = await getResellerUnitsModel();

    const [pending, done] = await Promise.all([
      ResellerUnits.countDocuments({ status: "pending" }),
      ResellerUnits.countDocuments({ status: "done" }),
    ]);

    return res.json({ pending, done, total: pending + done });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

  // GET /:id
  async findById(req, res) {
    try {
      const ResellerUnits = await getResellerUnitsModel();
      const unit = await ResellerUnits.findById(req.params.id).lean();
      if (!unit) return res.status(404).json({ error: "Unidade não encontrada" });
      return res.json(unit);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // PUT /:id
  async updateOne(req, res) {
    try {
      const { status, reseller, askedBy, unit_number } = req.body;

      if (status && !VALID_STATUSES.includes(status))
        return res.status(400).json({ error: `Status inválido. Use: ${VALID_STATUSES.join(", ")}` });

      const ResellerUnits = await getResellerUnitsModel();
      const unit = await ResellerUnits.findByIdAndUpdate(
        req.params.id,
        { $set: { status, reseller, askedBy, unit_number } },
        { new: true, lean: true }
      );

      if (!unit) return res.status(404).json({ error: "Unidade não encontrada" });
      return res.json(unit);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // DELETE /:id
  async deleteOne(req, res) {
    try {
      const ResellerUnits = await getResellerUnitsModel();
      const unit = await ResellerUnits.findByIdAndDelete(req.params.id).lean();
      if (!unit) return res.status(404).json({ error: "Unidade não encontrada" });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export default new ResellerUnitsController();