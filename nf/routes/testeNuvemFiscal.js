const express = require("express");
const router = express.Router();
const { obterToken, CONFIG } = require("../services/nuvemfiscal");

// 🔹 Testa autenticação e retorna token
router.get("/token", async (req, res) => {
  try {
    console.log("🚀 Testando conexão com Nuvem Fiscal...");
    console.log("🌎 Ambiente:", CONFIG.AMBIENTE);
    console.log("🔗 URL API:", CONFIG.API_URL);

    const token = await obterToken();

    console.log("✅ Token obtido com sucesso!");
    res.json({
      sucesso: true,
      ambiente: CONFIG.AMBIENTE,
      api_url: CONFIG.API_URL,
      auth_url: CONFIG.AUTH_URL,
      token: token,
      mensagem: "Token obtido com sucesso"
    });
  } catch (erro) {
    console.error("❌ Erro ao obter token:", erro.message);
    res.status(500).json({
      sucesso: false,
      erro: erro.message
    });
  }
});

module.exports = router;
