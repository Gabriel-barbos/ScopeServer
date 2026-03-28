import dotenv from "dotenv";
import dns from "node:dns/promises";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

dns.setServers(["1.1.1.1", "8.8.8.8"]);

// ── Conexão ──────────────────────────────────────────────────────────────────

const conn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
const db   = conn.useDb("scopebr");

// ── Schemas mínimos ───────────────────────────────────────────────────────────

const ScheduleSchema = new mongoose.Schema({}, { strict: false });
const ServiceSchema  = new mongoose.Schema({}, { strict: false });

const Schedule = db.model("Schedule", ScheduleSchema);
const Service  = db.model("Service",  ServiceSchema);

// ── Campos a copiar (só se vazio no Service) ──────────────────────────────────

const FIELDS_TO_COPY = [
  "orderNumber", "orderDate", "scheduledDate",
  "responsible", "responsiblePhone", "condutor",
  "serviceLocation", "vehicleGroup", "situation",
  "ticketNumber", "subject", "description", "category",
  "maintenanceRequest", "reason",
];

// ── Migração ──────────────────────────────────────────────────────────────────

const services = await Service.find({
  source:   "validation",
  schedule: { $exists: true, $ne: null },
}).lean();

console.log(`\n🔍 Services com agendamento vinculado: ${services.length}\n`);

let updated  = 0;
let skipped  = 0;
let notFound = 0;

for (const service of services) {
  const schedule = await Schedule.findById(service.schedule).lean();

  if (!schedule) {
    console.warn(`⚠️  Schedule não encontrado para Service ${service._id}`);
    notFound++;
    continue;
  }

  const patch = {};

  for (const field of FIELDS_TO_COPY) {
    const alreadyFilled = service[field] != null && service[field] !== "";
    const hasValue      = schedule[field] != null && schedule[field] !== "";

    if (!alreadyFilled && hasValue) {
      patch[field] = schedule[field];
    }
  }

  if (Object.keys(patch).length === 0) {
    skipped++;
    continue;
  }

  await Service.updateOne({ _id: service._id }, { $set: patch });

  console.log(`✅ Service ${service._id} | campos copiados: ${Object.keys(patch).join(", ")}`);
  updated++;
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Atualizados : ${updated}
⏭️  Sem mudança : ${skipped}
❌ Sem schedule : ${notFound}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

await conn.close();