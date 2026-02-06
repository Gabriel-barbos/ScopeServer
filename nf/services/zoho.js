const express = require("express");
const router = express.Router();
const axios = require("axios");

// Credenciais Zoho
const ZOHO_CLIENT_ID = "1000.Y90MMIV8G9CYW2LO1OFD6GWPUQODCE";
const ZOHO_CLIENT_SECRET = "02953cc6a7860b7ff40e8e1cae92fc7da170975d36";
const ZOHO_REFRESH_TOKEN = "1000.5e4682dd93d9df2f221d922d935081c1.dc860080a8423845ba0916cc324dcb2f";

// Função para gerar token
async function getZohoAccessToken() {
  const response = await axios.post(
    "https://accounts.zoho.eu/oauth/v2/token",
    null,
    {
      params: {
        refresh_token: ZOHO_REFRESH_TOKEN,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        grant_type: "refresh_token",
      },
    }
  );
  return response.data.access_token;
}

// Buscar pedidos com NF pendente
async function getPedidosEmissaoNF() {
  const accessToken = await getZohoAccessToken();
  const response = await axios.get(
    "https://creator.zoho.eu/api/v2/scopetechnology/scope-brazil-project-managment/report/Pedido_Report",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { criteria: '(Est_gios=="Emissão NF")' },
    }
  );
  return response.data.data;
}

// Atualizar pedido com número da nota
async function updateNumeroNota(recordId, numeroNota) {
  const accessToken = await getZohoAccessToken();
  const url = `https://creator.zoho.eu/api/v2/scopetechnology/scope-brazil-project-managment/report/Pedido_Report/${recordId}`;

  const body = { data: { Numero_da_Nota: numeroNota } };

  const response = await axios.patch(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

// GET /zoho/pedidos → lista pedidos pendentes
router.get("/pedidos", async (req, res) => {
  try {
    const pedidos = await getPedidosEmissaoNF();
    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar pedidos Zoho" });
  }
});

// PATCH /zoho/pedidos/:id → atualiza número da nota
router.patch("/pedidos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { numeroNota } = req.body;
    const result = await updateNumeroNota(id, numeroNota);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar número da nota" });
  }
});


module.exports = router;
