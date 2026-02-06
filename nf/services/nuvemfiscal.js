import fetch from "node-fetch";

const CONFIG = {
  CLIENT_ID: process.env.NUVEM_FISCAL_CLIENT_ID,
  CLIENT_SECRET: process.env.NUVEM_FISCAL_CLIENT_SECRET,
  AMBIENTE: process.env.NUVEM_FISCAL_AMBIENTE || "sandbox",

  get AUTH_URL() {
    return "https://auth.nuvemfiscal.com.br/oauth/token";
  },

  get API_URL() {
    return this.AMBIENTE === "sandbox"
      ? "https://api.sandbox.nuvemfiscal.com.br/nfe"
      : "https://api.nuvemfiscal.com.br/nfe";
  },

  get PDF_URL() {
    return this.AMBIENTE === "sandbox"
      ? "https://api.sandbox.nuvemfiscal.com.br/nfe/eventos"
      : "https://api.nuvemfiscal.com.br/nfe/eventos";
  }
};

// Falha rápida em produção
if (!CONFIG.CLIENT_ID || !CONFIG.CLIENT_SECRET) {
  throw new Error("❌ Nuvem Fiscal: CLIENT_ID ou CLIENT_SECRET não configurados no ambiente");
}

let tokenCache = null;
let tokenExpiry = null;

async function obterToken() {
  if (tokenCache && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    return tokenCache;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CONFIG.CLIENT_ID,
    client_secret: CONFIG.CLIENT_SECRET,
    scope: "nfe"
  });

  const response = await fetch(CONFIG.AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`Erro ao obter token Nuvem Fiscal (${response.status}): ${rawBody}`);
  }

  const data = JSON.parse(rawBody);

  tokenCache = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  console.log(`🔑 Token Nuvem Fiscal obtido (expira em ${data.expires_in}s)`);
  return tokenCache;
}

async function emitirNFe(jsonNF) {
  const token = await obterToken();

  console.log(`📤 Enviando NF-e (${CONFIG.AMBIENTE})`);
  console.log(`   Número: ${jsonNF.infNFe.ide.nNF}`);

  const response = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(jsonNF)
  });

  const contentType = response.headers.get("content-type");
  const rawBody = await response.text();

  if (!response.ok) {
    console.error("❌ Erro Nuvem Fiscal:", rawBody);
    throw new Error(`Erro Nuvem Fiscal ${response.status}: ${rawBody}`);
  }

  if (!contentType?.includes("application/json")) {
    throw new Error("Resposta inesperada da Nuvem Fiscal: " + rawBody);
  }

  const responseData = JSON.parse(rawBody);

  console.log("✅ NF-e enviada com sucesso");
  return analisarRespostaNF(responseData);
}

function analisarRespostaNF(responseApi) {
  const { status, numero, chave, autorizacao } = responseApi;

  if (status === "autorizado" && autorizacao?.status === "registrado") {
    return {
      sucesso: true,
      status: "autorizado",
      numero,
      chave,
      eventoId: autorizacao.id,
      protocolo: autorizacao.numero_protocolo,
      motivo: autorizacao.motivo_status,
      dataAutorizacao: autorizacao.data_evento || new Date().toISOString()
    };
  }

  if (status === "rejeitado" || autorizacao?.status === "rejeitado") {
    return {
      sucesso: false,
      status: "rejeitado",
      numero,
      chave,
      codigoErro: autorizacao?.codigo_status,
      motivoErro: autorizacao?.motivo_status
    };
  }

  return {
    sucesso: false,
    status: status || "desconhecido",
    numero,
    chave,
    motivoErro: `Status não esperado: ${status}`
  };
}

async function buscarPDF(eventoId) {
  const token = await obterToken();

  const response = await fetch(`${CONFIG.PDF_URL}/${eventoId}/pdf`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao buscar PDF (${response.status}): ${text}`);
  }

  return await response.buffer();
}

export {
  emitirNFe,
  buscarPDF,
  obterToken,
  CONFIG
};
