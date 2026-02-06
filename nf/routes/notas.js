import express from 'express';
import * as notaController from '../controllers/nota.controller.js';
import getNotaModel from '../models/Nota.js';
const router = express.Router();

router.post('/emitir', notaController.emitirNota);


router.get('/historico', notaController.listarHistorico);


router.get('/:eventoId/pdf', notaController.buscarPDFNota);


router.get('/ultima', async (req, res) => {
  try {
    const NotaFiscal = await getNotaModel();
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


router.put('/ultima', async (req, res) => {
  try {
    const { novoNumero } = req.body;

    if (typeof novoNumero !== 'number') {
      return res.status(400).json({ message: 'O novo número deve ser um número válido' });
    }

    const NotaFiscal = await getNotaModel();
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

export default router;