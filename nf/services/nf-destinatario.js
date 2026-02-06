const {
  padronizarCEP,
  padronizarCPF,
  padronizarCNPJ,
  obterCodigoIBGE,
  limparTextoNFe
} = require('./utils');

/**
 * @param {Object} d 
 * @param {Object} defaults 
 * @returns {Object} 
 */
function montarDestinatario(d, defaults) {
  // Validações básicas
  if (!d.Nome) throw new Error('Nome do destinatário é obrigatório');
  if (!d.Cidade) throw new Error('Cidade do destinatário é obrigatória');
  if (!d.Estado) throw new Error('Estado do destinatário é obrigatório');
  if (!d.CEP) throw new Error('CEP do destinatário é obrigatório');
  if (!d.Endereco) throw new Error('Endereço do destinatário é obrigatório');
  if (!d.Bairro) throw new Error('Bairro do destinatário é obrigatório');

  // Tratar telefone
  let telefone = (d.Telefone || d.Celular || "").replace(/\D/g, "");
  if (telefone.length < 6) telefone = "1133334444";
  if (telefone.length > 14) telefone = telefone.slice(0, 14);

  // Obter código IBGE (com tratamento de erro detalhado)
  let codigoMunicipio;
  try {
    codigoMunicipio = obterCodigoIBGE(d.Cidade, d.Estado);
  } catch (error) {
    throw new Error(
      `Erro ao buscar código IBGE: ${error.message} | ` +
      `Dados: Cidade="${d.Cidade}", Estado="${d.Estado}"`
    );
  }

  // Determinar tipo de pessoa
  const cnpjLimpo = (d.CNPJ || "").replace(/\D/g, "");
  const cpfLimpo = (d.CPF || "").replace(/\D/g, "");
  const isEmpresa = cnpjLimpo && cnpjLimpo !== "00000000000000" && cnpjLimpo.length === 14;

  // Validar CPF ou CNPJ
  if (!isEmpresa && (!cpfLimpo || cpfLimpo.length !== 11)) {
    throw new Error(`CPF inválido: ${d.CPF}`);
  }
  if (isEmpresa && cnpjLimpo.length !== 14) {
    throw new Error(`CNPJ inválido: ${d.CNPJ}`);
  }

  // Lógica de Indicador de IE
  let indIEDest, ieDestinatario;
  
  if (!isEmpresa) {
    // CPF: sempre não contribuinte
    indIEDest = 9;
    ieDestinatario = undefined;
  } else {
    // CNPJ: verificar IE
    const ieNumeros = (d.IE || "").replace(/\D/g, "");
    
    if (ieNumeros && ieNumeros.length >= 2 && ieNumeros.length <= 14) {
      indIEDest = 1; // Contribuinte
      ieDestinatario = ieNumeros;
    } else {
      indIEDest = 9; // Não contribuinte
      ieDestinatario = undefined;
    }
  }

  const destinatario = {
    CPF: isEmpresa ? undefined : padronizarCPF(cpfLimpo),
    CNPJ: isEmpresa ? padronizarCNPJ(cnpjLimpo) : undefined,
    xNome: limparTextoNFe(d.Nome || d["﻿Nome/Razão Social"]),
    indIEDest,
    IE: ieDestinatario,
    enderDest: {
      xLgr: limparTextoNFe(d.Endereco || d.Endereço || d.Rua),
      nro: limparTextoNFe(d.Numero || d.Número) || "S/N",
      xCpl: limparTextoNFe(d.Complemento) || undefined,
      xBairro: limparTextoNFe(d.Bairro),
      cMun: parseInt(codigoMunicipio),
      xMun: limparTextoNFe(d.Cidade),
      UF: d.Estado.toUpperCase(),
      CEP: padronizarCEP(d.CEP),
      cPais: 1058,
      xPais: "BRASIL",
      fone: telefone
    }
  };

  // Log para debug (remover em produção)
  console.log(`✅ Destinatário montado: ${destinatario.xNome}`);
  console.log(`   Município: ${destinatario.enderDest.xMun}/${destinatario.enderDest.UF}`);
  console.log(`   Código IBGE: ${destinatario.enderDest.cMun}`);

  return destinatario;
}

module.exports = { montarDestinatario };