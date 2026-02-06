import mongoose from "mongoose";
import { getNfDB } from "../../config/databases.js";

const DestinatarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  apelido: { type: String, default: "" },
  tipo: { type: String, default: "Padrão" },
  sexo: { type: String, default: "" },
  cpf: { type: String, default: "" },   
  rg: { type: String, default: "" },
  expedicaoRg: { type: String, default: "" },
  ufRg: { type: String, default: "" },
  indicadorIe: { type: String, default: "" },
  cnpj: { type: String, default: "" },  
  ie: { type: String, default: "" },
  telefone: { type: String, default: "" },
  celular: { type: String, default: "" },
  fax: { type: String, default: "" },
  email: { type: String, default: "" },
  site: { type: String, default: "" },
  endereco: { type: String, default: "" },
  numero: { type: String, default: "" },
  complemento: { type: String, default: "-" },
  bairro: { type: String, default: "" },
  cidade: { type: String, default: "" },
  estado: { type: String, default: "" },
  cep: { type: String, default: "" },
  dataNascimento: { type: String, default: "" }
}, { timestamps: true });

let nfDB = null;
let Destinatario = null;

const getDestinatarioModel = async () => {
  if (Destinatario) return Destinatario;
  
  if (!nfDB) {
    nfDB = await getNfDB();
  }
  
  Destinatario = nfDB.models.Destinatario || nfDB.model("Destinatario", DestinatarioSchema, "Destinatarios");
  return Destinatario;
};

export default getDestinatarioModel;