import {
  padronizarCEP,
  padronizarCPF,
  padronizarCNPJ,
  obterCodigoIBGE,
  limparTextoNFe
} from './utils.js';

// Regex simples para detectar CEP (8 dígitos, com ou sem hífen/espaços)
const CEP_REGEX = /^\s*\d{5}-?\d{3}\s*$/;

// Detecta se o valor parece um CEP em vez de nome de cidade
function pareceCodigoPostal(valor) {
  return CEP_REGEX.test(valor);
}

function montarDestinatario(d, defaults) {
  if (!d.Nome)      throw new Error('Nome do destinatário é obrigatório');
  if (!d.Cidade)    throw new Error('Cidade do destinatário é obrigatória');
  if (!d.Estado)    throw new Error('Estado do destinatário é obrigatório');
  if (!d.CEP)       throw new Error('CEP do destinatário é obrigatório');
  if (!d.Endereco)  throw new Error('Endereço do destinatário é obrigatório');
  if (!d.Bairro)    throw new Error('Bairro do destinatário é obrigatório');

  // Sanitiza cidade (remove espaços extras e caracteres invisíveis)
  const cidadeLimpa = (d.Cidade || '').trim().replace(/\s+/g, ' ');

  // Detecta campo de cidade preenchido erroneamente com CEP
  if (pareceCodigoPostal(cidadeLimpa)) {
    throw new Error(
      `Campo "Cidade" contém um CEP ("${cidadeLimpa}") em vez do nome da cidade. ` +
      `Verifique o mapeamento dos campos no pedido.`
    );
  }

  if (!cidadeLimpa) {
    throw new Error('Cidade do destinatário está vazia após sanitização');
  }

  let telefone = (d.Telefone || d.Celular || '').replace(/\D/g, '');
  if (telefone.length < 6)  telefone = '1133334444';
  if (telefone.length > 14) telefone = telefone.slice(0, 14);

  let codigoMunicipio;
  try {
    codigoMunicipio = obterCodigoIBGE(cidadeLimpa, d.Estado);
  } catch (error) {
    throw new Error(
      `Erro ao buscar código IBGE: ${error.message} | ` +
      `Dados recebidos: Cidade="${d.Cidade}", Estado="${d.Estado}"`
    );
  }

  const cnpjLimpo = (d.CNPJ || '').replace(/\D/g, '');
  const cpfLimpo  = (d.CPF  || '').replace(/\D/g, '');
  const isEmpresa = cnpjLimpo && cnpjLimpo !== '00000000000000' && cnpjLimpo.length === 14;

  if (!isEmpresa && (!cpfLimpo || cpfLimpo.length !== 11)) {
    throw new Error(`CPF inválido: "${d.CPF}"`);
  }
  if (isEmpresa && cnpjLimpo.length !== 14) {
    throw new Error(`CNPJ inválido: "${d.CNPJ}"`);
  }

  let indIEDest, ieDestinatario;

  if (!isEmpresa) {
    indIEDest = 9;
    ieDestinatario = undefined;
  } else {
    const ieNumeros = (d.IE || '').replace(/\D/g, '');
    if (ieNumeros && ieNumeros.length >= 2 && ieNumeros.length <= 14) {
      indIEDest = 1;
      ieDestinatario = ieNumeros;
    } else {
      indIEDest = 9;
      ieDestinatario = undefined;
    }
  }

  const destinatario = {
    CPF:  isEmpresa ? undefined : padronizarCPF(cpfLimpo),
    CNPJ: isEmpresa ? padronizarCNPJ(cnpjLimpo) : undefined,
    xNome: limparTextoNFe(d.Nome || d['﻿Nome/Razão Social']),
    indIEDest,
    IE: ieDestinatario,
    enderDest: {
      xLgr:  limparTextoNFe(d.Endereco || d.Endereço || d.Rua),
      nro:   limparTextoNFe(d.Numero || d.Número) || 'S/N',
      xCpl:  limparTextoNFe(d.Complemento) || undefined,
      xBairro: limparTextoNFe(d.Bairro),
      cMun:  parseInt(codigoMunicipio),
      xMun:  limparTextoNFe(cidadeLimpa),
      UF:    d.Estado.toUpperCase(),
      CEP:   padronizarCEP(d.CEP),
      cPais: 1058,
      xPais: 'BRASIL',
      fone:  telefone,
    },
  };

  console.log(` Destinatário montado: ${destinatario.xNome}`);
  console.log(`   Município: ${destinatario.enderDest.xMun}/${destinatario.enderDest.UF}`);
  console.log(`   Código IBGE: ${destinatario.enderDest.cMun}`);

  return destinatario;
}

export { montarDestinatario };