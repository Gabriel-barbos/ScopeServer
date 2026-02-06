import mongoose from "mongoose";
import { getNfDB } from "../../config/databases.js";

const notaFiscalSchema = new mongoose.Schema({
  numero: {
    type: Number,
    required: true
  },
  eventoId: {
    type: String,
    required: true,
    unique: true
  },
  dataAutorizacao: {
    type: Date,
    required: true
  },
  protocolo: {
    type: String,
    required: true
  },
  destinatario: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

let nfDB = null;
let NotaFiscal = null;

const getNotaModel = async () => {
  if (NotaFiscal) return NotaFiscal;
  
  if (!nfDB) {
    nfDB = await getNfDB();
  }
  
  NotaFiscal = nfDB.models.NotaFiscal || nfDB.model("NotaFiscal", notaFiscalSchema);
  return NotaFiscal;
};

export default getNotaModel;