import {
  padronizarCEP,
  padronizarCPF,
  padronizarCNPJ,
  obterCodigoIBGE,
  limparTextoNFe,
  resolverCidadeEUF,
} from './utils.js';

async function montarDestinatario(d, defaults) {
  if (!d.Nome)     throw new Error('Nome do destinatário é obrigatório');
  if (!d.Estado)   throw new Error('Estado do destinatário é obrigatório');
  if (!d.CEP)      throw new Error('CEP do destinatário é obrigatório');
  if (!d.Endereco) throw new Error('Endereço do destinatário é obrigatório');
  if (!d.Bairro)   throw new Error('Bairro do destinatário é obrigatório');

  // Resolve cidade se vier trocada com o CEP, consulta o ViaCEP automaticamente
  const { cidade, uf } = await resolverCidadeEUF(d.Cidade, d.Estado, d.CEP);

  if (!cidade) throw new Error('Não foi possível determinar a cidade do destinatário');

  let telefone = (d.Telefone || d.Celular || '').replace(/\D/g, '');
  if (telefone.length < 6)  telefone = '1133334444';
  if (telefone.length > 14) telefone = telefone.slice(0, 14);

  let codigoMunicipio;
  try {
    codigoMunicipio = obterCodigoIBGE(cidade, uf);
  } catch (error) {
    throw new Error(
      `Erro ao buscar código IBGE: ${error.message} | ` +
      `Dados resolvidos: Cidade="${cidade}", Estado="${uf}" | ` +
      `Dados originais: Cidade="${d.Cidade}", Estado="${d.Estado}"`
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
      xLgr:    limparTextoNFe(d.Endereco || d.Endereço || d.Rua),
      nro:     limparTextoNFe(d.Numero || d.Número) || 'S/N',
      xCpl:    limparTextoNFe(d.Complemento) || undefined,
      xBairro: limparTextoNFe(d.Bairro),
      cMun:    parseInt(codigoMunicipio),
      xMun:    limparTextoNFe(cidade),
      UF:      uf.toUpperCase(),
      CEP:     padronizarCEP(d.CEP),
      cPais:   1058,
      xPais:   'BRASIL',
      fone:    telefone,
    },
  };

  console.log(` Destinatário montado: ${destinatario.xNome}`);
  console.log(`   Município: ${destinatario.enderDest.xMun}/${destinatario.enderDest.UF}`);
  console.log(`   Código IBGE: ${destinatario.enderDest.cMun}`);

  return destinatario;
}

export { montarDestinatario }; 