import express from 'express';
import getToken from '../services/GetToken.js';

const router = express.Router();

router.post('/get-token', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username e password são obrigatórios' });
    }

    const access_token = await getToken({
      login: username,
      password: password,
    });

    return res.status(200).json({
      access_token,
      token_type: 'Bearer',
    });
  } catch (err) {
    console.error('❌ Erro ao gerar token:', err.message);
    return res.status(401).json({ error: err.message });
  }
});

export default router;