const fetch = require('node-fetch');

const CONFIG = {
  CLIENT_ID: process.env.NUVEM_FISCAL_CLIENT_ID || "Ypw1yFRR2tCHqyrx5YVR",
  CLIENT_SECRET: process.env.NUVEM_FISCAL_CLIENT_SECRET || "N6wyZStdtvQceilcNqYOfsTvVgUhC4cjqS8ueGz9",
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

let tokenCache = null;
let tokenExpiry = null;

/**
 * Obtém token de autenticação da Nuvem Fiscal
 * @returns {Promise<string>} Access token
 */
async function obterToken() {
  // Verifica se token ainda é válido (margem de 5 min)
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

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Erro ao obter token Nuvem Fiscal: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  tokenCache = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000); // Converte segundos para ms
  
  console.log(`🔑 Token Nuvem Fiscal obtido (expira em ${data.expires_in}s)`);
  return tokenCache;
}

/**
 * Emite NF-e na Nuvem Fiscal
 * @param {Object} jsonNF - JSON da NF-e no formato da API
 * @returns {Promise<Object>} Resposta da API com chave, protocolo, etc.
 */
async function emitirNFe(jsonNF) {
  const token = await obterToken();
  
  console.log(`📤 Enviando NF-e para Nuvem Fiscal (${CONFIG.AMBIENTE})...`);
  console.log(`   Número: ${jsonNF.infNFe.ide.nNF}`);

  const response = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(jsonNF)
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error("❌ Erro na emissão:", responseData);
    throw new Error(`Erro Nuvem Fiscal ${response.status}: ${JSON.stringify(responseData)}`);
  }

  console.log("✅ NF-e enviada com sucesso!");
  return analisarRespostaNF(responseData);
}

/**
 * Analisa resposta da API e retorna estrutura padronizada
 * @param {Object} responseApi - Resposta da Nuvem Fiscal
 * @returns {Object} Resultado padronizado
 */
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

/**
 * Busca PDF da NF-e autorizada
 * @param {string} eventoId - ID do evento retornado pela API
 * @returns {Promise<Buffer>} Buffer do PDF
 */
async function buscarPDF(eventoId) {
  const token = await obterToken();
  
  console.log(`📄 Buscando PDF do evento: ${eventoId}`);

  const response = await fetch(`${CONFIG.PDF_URL}/${eventoId}/pdf`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar PDF: ${response.status}`);
  }

  return await response.buffer();
}

module.exports = {
  emitirNFe,
  buscarPDF,
  obterToken, // Exporta para testes
  CONFIG // Exporta para verificação de ambiente
};