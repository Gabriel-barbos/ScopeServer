const express = require('express');
const router = express.Router();
const notaController = require('../controllers/nota.controller');
const NotaFiscal = require('../models/Nota'); // ajuste o caminho se necessário

/**
 * POST /api/notas/emitir
 * Emite NF-e e retorna PDF
 */
router.post('/emitir', notaController.emitirNota);

/**
 * GET /api/notas/historico
 * Lista todas notas emitidas
 */
router.get('/historico', notaController.listarHistorico);

/**
 * GET /api/notas/:eventoId/pdf
 * Busca PDF de nota específica
 */
router.get('/:eventoId/pdf', notaController.buscarPDFNota);

/**
 * GET /api/notas/ultima
 * Retorna a última nota emitida
 */
router.get('/ultima', async (req, res) => {
  try {
    const ultimaNota = await NotaFiscal.findOne().sort({ numero: -1, createdAt: -1 });

    if (!ultimaNota) {
      return res.status(404).json({ message: 'Nenhuma nota encontrada' });
    }

    res.status(200).json(ultimaNota);
  } catch (error) {
    console.error('Erro ao buscar última nota:', error);
    res.status(500).json({ message: 'Erro ao buscar última nota', error });
  }
});

/**
 * PUT /api/notas/ultima
 * Atualiza o número da última nota emitida
 */
router.put('/ultima', async (req, res) => {
  try {
    const { novoNumero } = req.body;

    if (typeof novoNumero !== 'number') {
      return res.status(400).json({ message: 'O novo número deve ser um número válido' });
    }

    const ultimaNota = await NotaFiscal.findOne().sort({ numero: -1, createdAt: -1 });

    if (!ultimaNota) {
      return res.status(404).json({ message: 'Nenhuma nota encontrada' });
    }

    ultimaNota.numero = novoNumero;
    await ultimaNota.save();

    res.status(200).json({
      message: 'Número da última nota atualizado com sucesso',
      notaAtualizada: ultimaNota
    });
  } catch (error) {
    console.error('Erro ao atualizar número da última nota:', error);
    res.status(500).json({ message: 'Erro ao atualizar número da última nota', error });
  }
});

module.exports = router;
