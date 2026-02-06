const mongoose = require('mongoose');

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

module.exports = mongoose.model('NotaFiscal', notaFiscalSchema);