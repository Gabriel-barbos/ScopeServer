import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const produtoMap = {
  "Teltonika Com Bloqueio + I-Button": ["Chicote Elétrico Padrão", "I-BUTTON PRETO", "LEITOR I-BUTTON"],
  "2G - Sem Bloqueio": ["Chicote Elétrico Padrão"],
  "2G - Com Bloqueio": ["Chicote Elétrico Padrão"],
  "2G - Com Bloqueio CAOA": ["Chicote Elétrico Padrão"],
  "2G - Com Bloqueio Padrão": ["Chicote Elétrico Padrão"],
  "2G - Com Bloqueio Padrão + RFID + Buzzer": ["Chicote Elétrico Padrão", "LEITOR DE CARTÃO RFID"],
  "2G - Com Bloqueio Padrão 24V": ["Chicote Elétrico Padrão"],
  "4G - Com Bloqueio + Buzzer": ["Chicote Elétrico Padrão"],
  "2G - Sem bloqueio + Buzzer": ["Chicote Elétrico Padrão"],
  " 2G - Sem bloqueio + Buzzer": ["Chicote Elétrico Padrão"],
  "2G - Com Bloqueio + Buzzer": ["Chicote Elétrico Padrão"],
  "4G - Com Bloqueio Padrão": ["Chicote Elétrico Padrão"],
  "4G - Com Bloqueio Padrão 24V": ["Chicote Elétrico Padrão"],
  "4G - Com Bloqueio Unidas": ["Chicote Elétrico Padrão"],
  "4G - Com Bloqueio Unidas 24V": ["Chicote Elétrico Padrão"],
  "4G - Sem Bloqueio": ["Chicote Elétrico Padrão"],
  "4G - Sem Bloqueio + Buzzer": ["Chicote Elétrico Padrão"],
  "MHUB Com Bloqueio + Buzzer + RFID + Sensor Chuva - 12V": ["Chicote Elétrico Padrão", "LEITOR DE CARTÃO RFID"],
  "MHUB Com Bloqueio + Buzzer + RFID + Sensor Chuva - 24V": ["Chicote Elétrico Padrão", "LEITOR DE CARTÃO RFID"],
  "Sem Chicote": [],
  "Teltonika Com Bloqueio + 2 Buzzer + RFID": ["Chicote Elétrico Padrão", "LEITOR DE CARTÃO RFID"],
  "Teltonika Com Bloqueio + eCAM": ["Chicote Elétrico Padrão", "ECAN02HWL301"],
  "Teltonika Com Bloqueio + eCAM + I-Button + Buzzer": ["Chicote Elétrico Padrão", "ECAN02HWL301", "I-BUTTON PRETO"],
  "Teltonika Com Bloqueio + I-Button + Buzzer": ["Chicote Elétrico Padrão", "I-BUTTON PRETO", "LEITOR I-BUTTON"],
  "Teltonika Com Bloqueio + RFID": ["Chicote Elétrico Padrão", "LEITOR DE CARTÃO RFID"],
  "Teltonika Com Bloqueio + Sensor Combustível": ["Chicote Elétrico Padrão"],
  "Teltonika Com Bloqueio + Sensor Combustível + I-Button": ["Chicote Elétrico Padrão", "I-BUTTON PRETO"],
  "Teltonika SEM Bloqueio + I-Button + Buzzer": ["I-BUTTON PRETO", "LEITOR I-BUTTON"],
  "X3Tech Com Bloqueio Padrão": ["Chicote Elétrico Padrão"],
  "X3Tech Com Bloqueio Unidas": ["Chicote Elétrico Padrão"],
  "X3Tech Sem Bloqueio Padrão": ["Chicote Elétrico Padrão"],
  "OBD | Teltonika FMC003": ["TELTONIKA FMC003"],
  "GV50": ["QUECKLINK GV50"],
  "GV50CG": ["QUECKLINK GV50 4G"],
  "GV75": ["QUECKLINK GV75"],
  "MHUB 369": ["MHUB 369"],
  "Teltonika FMB130": ["TELTONIKA FMB130"],
  "Teltonika FMC130": ["TELTONIKA FMC130"],
  "Teltonika FMC150": ["TELTONIKA FMC150"],
  "Teltonika FMC150 + eCAM02": ["TELTONIKA FMC150", "ECAN02HWL301"],
  "X3Tech XT40": ["RASTREADOR XT40 - X3TECH"],
  "X3Tech sem bloqueio": ["RASTREADOR XT40 - X3TECH"],
  "I-Button": ["I-BUTTON PRETO"],
  "eCAM2": ["ECAN02HWL301"],
  "Botão de Pânico": ["BOTÃO DE PÂNICO"],
  "Buzzer": [],
  "Cartão RFID SGBrás": ["CARTÃO RFID 2"],
  "Leitor RFID SGBrás": ["LEITOR I-BUTTON SGBRAS"],
  "Leitor RFID SGBras": ["LEITOR I-BUTTON SGBRAS"],
  "Chavinha CAOA": [],
  "I-Button + Leitor": ["I-BUTTON PRETO", "Leitor I-BUTTON"],
  "I-Button - 2 por equipamento": ["I-BUTTON PRETO", "I-BUTTON PRETO"],
  "Leitor RFID": ["LEITOR DE CARTÃO RFID"],
  "Leitor RFID + Cartão": ["LEITOR DE CARTÃO RFID", "CARTÃO RFID 2"],
  "Leitor RFID SGBrás + Cartão": ["LEITOR DE CARTÃO MAGNÉTICO DR102", "CARTÃO RFID 2"],
  "Mister S": ["SA MISTER S GV50"],
  "Scotchlock": [],
  "Scotchlock (conector fio)": [],
  "Sem Acessórios": [],
};

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf-8"));
}

function saveJSON(file, data) {
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(data, null, 2));
}

function aplicarConversao(nome) {
  if (!nome || nome.trim() === "") return [];
  const valores = produtoMap[nome];
  if (!valores) {
    console.warn(`Produto não encontrado no mapa: ${nome}`);
    return [nome];
  }
  return valores.filter(v => v && v.trim() !== "");
}

function getDisplayValue(campo) {
  if (!campo) return '';
  return typeof campo === 'object' && campo.display_value
    ? campo.display_value.trim()
    : String(campo).trim();
}

function buscarProduto(apiProdNome, produtosCatalogo) {
  return produtosCatalogo.find(
    p => p["Descrição"].toUpperCase() === apiProdNome.toUpperCase()
  );
}

function padronizarCEP(cep) {
  return (cep || "").replace(/\D/g, "").padStart(8, "0");
}

function padronizarCPF(cpf) {
  return (cpf || "").replace(/\D/g, "").padStart(11, "0");
}

function padronizarCNPJ(cnpj) {
  return (cnpj || "").replace(/\D/g, "").padStart(14, "0");
}

function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Detecta se o valor parece um CEP 
function pareceCEP(valor) {
  return /^\d{5}-?\d{3}$/.test((valor || '').trim().replace(/\s+/g, ''));
}

/**
 * Consulta o ViaCEP e retorna { cidade, uf }.
 * Lança erro se o CEP for inválido ou não encontrado.
  */

async function resolverCidadePorCEP(cep) {
  const cepLimpo = cep.replace(/\D/g, '');

  if (cepLimpo.length !== 8) {
    throw new Error(`CEP inválido para consulta: "${cep}"`);
  }

  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

  if (!res.ok) {
    throw new Error(`ViaCEP retornou status ${res.status} para o CEP "${cep}"`);
  }

  const data = await res.json();

  if (data.erro) {
    throw new Error(`CEP "${cep}" não encontrado no ViaCEP`);
  }

  console.log(` ViaCEP: CEP ${cepLimpo} → ${data.localidade}/${data.uf}`);
  return { cidade: data.localidade, uf: data.uf };
}

/**
 * Retorna { cidade, uf } resolvidos.
 * Se cidadeRaw parecer um CEP, consulta o ViaCEP para obter a cidade real.
 * O parâmetro cepFallback é o CEP do destinatário (usado quando cidade está trocada).
 */
async function resolverCidadeEUF(cidadeRaw, ufRaw, cepFallback) {
  // Remove tabs, espaços e outros whitespace de qualquer tipo
  const cidadeTrimada = (cidadeRaw || '').replace(/\s+/g, ' ').trim();

  if (!pareceCEP(cidadeTrimada)) {
    // Caminho normal
    return { cidade: cidadeTrimada, uf: (ufRaw || '').trim() };
  }

  // Cidade veio com CEP — tenta resolver pelo próprio valor ou pelo CEP do destinatário
  const cepParaConsulta = cidadeTrimada || cepFallback;
  console.warn(`  Campo "Cidade" contém CEP ("${cidadeTrimada}"). Consultando ViaCEP...`);

  const resultado = await resolverCidadePorCEP(cepParaConsulta);

  // Se a UF também estiver estranha, usa a retornada pelo ViaCEP
  const ufFinal = (ufRaw || '').trim().length === 2 ? ufRaw.trim() : resultado.uf;

  return { cidade: resultado.cidade, uf: ufFinal };
}

function obterCodigoIBGE(cidade, uf) {
  const municipiosIBGE = loadJSON("ibge.json");

  if (!cidade || !uf) {
    throw new Error(`Cidade ou UF inválida: ${cidade}/${uf}`);
  }

  const cidadeNorm = normalizarTexto(cidade);
  const ufUpper = uf.toUpperCase().trim();

  const codigosUF = {
    'AC': 12, 'AL': 27, 'AP': 16, 'AM': 13, 'BA': 29, 'CE': 23,
    'DF': 53, 'ES': 32, 'GO': 52, 'MA': 21, 'MT': 51, 'MS': 50,
    'MG': 31, 'PA': 15, 'PB': 25, 'PR': 41, 'PE': 26, 'PI': 22,
    'RJ': 33, 'RN': 24, 'RS': 43, 'RO': 11, 'RR': 14, 'SC': 42,
    'SP': 35, 'SE': 28, 'TO': 17,
  };

  const codigoUF = codigosUF[ufUpper];
  if (!codigoUF) throw new Error(`UF inválida: ${ufUpper}`);

  // 1ª Busca: exata
  let municipio = municipiosIBGE.find(m =>
    normalizarTexto(m.nome) === cidadeNorm && m.codigo_uf === codigoUF
  );

  // 2ª Busca: remove artigos/preposições
  if (!municipio) {
    const cidadeLimpa = cidadeNorm
      .replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    municipio = municipiosIBGE.find(m => {
      const nomeLimpo = normalizarTexto(m.nome)
        .replace(/\b(DE|DO|DA|DOS|DAS|E)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return nomeLimpo === cidadeLimpa && m.codigo_uf === codigoUF;
    });
  }

  // 3ª Busca: parcial
  if (!municipio) {
    municipio = municipiosIBGE.find(m =>
      normalizarTexto(m.nome).includes(cidadeNorm) && m.codigo_uf === codigoUF
    );
  }

  if (!municipio) {
    throw new Error(`Município não encontrado no IBGE: ${cidade}/${ufUpper} (Código UF: ${codigoUF})`);
  }

  return municipio.codigo_ibge.toString();
}

function limparTextoNFe(texto) {
  if (!texto) return "";
  return texto.trim().replace(/\s+/g, " ").replace(/^[\s-]+|[\s-]+$/g, "") || "";
}

function sanitizeFilename(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_");
}

export {
  produtoMap,
  loadJSON,
  saveJSON,
  aplicarConversao,
  getDisplayValue,
  buscarProduto,
  padronizarCEP,
  padronizarCPF,
  padronizarCNPJ,
  obterCodigoIBGE,
  normalizarTexto,
  limparTextoNFe,
  sanitizeFilename,
  pareceCEP,
  resolverCidadeEUF,
};