const mongoose = require("mongoose");

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

module.exports = mongoose.model("Destinatario", DestinatarioSchema, "Destinatarios");
