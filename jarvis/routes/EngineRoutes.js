import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import RoutineEngine from '../services/RoutineEngine.js';
import RoutineEngineTest from '../services/RoutineEngineTest.js';

const router = express.Router();

// Armazena em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
});

//teste
router.post('/engine-test', upload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    // Cria arquivo temporário
    tempFilePath = path.join(os.tmpdir(), `engine-test-${Date.now()}.xlsx`);
    await fs.writeFile(tempFilePath, req.file.buffer);

    const result = await RoutineEngineTest.execute({
      filePath: tempFilePath,
    });

    return res.json(result);
  } catch (err) {
    console.error('Engine test error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    // Limpa arquivo temporário
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        console.error('Erro ao deletar arquivo temporário:', e);
      }
    }
  }
});

//produção
router.post('/engine', upload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    // Cria arquivo temporário do buffer
    tempFilePath = path.join(os.tmpdir(), `engine-prod-${Date.now()}.xlsx`);
    await fs.writeFile(tempFilePath, req.file.buffer);

    const result = await RoutineEngine.execute({
      filePath: tempFilePath,
    });

    return res.json(result);
  } catch (err) {
    console.error(' Engine error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    // Limpa arquivo temporário
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        console.error('Erro ao deletar arquivo temporário:', e);
      }
    }
  }
});

export default router;