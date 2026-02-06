const {
  aplicarConversao,
  getDisplayValue,
  buscarProduto
} = require('./utils');

/**
 * @param {Object} pedido - Dados do pedido
 * @param {Object} destinatario - Dados do destinatário
 * @param {Array} produtosCatalogo - Catálogo de produtos
 * @param {Object} defaults - Configurações padrão
 * @returns {Array} Lista de produtos formatados para a NF-e
 */
function normalizarProdutos(pedido, destinatario, produtosCatalogo, defaults) {
  const itensMap = new Map();
  const produtosJaAdicionados = new Set();

  function addProduto(nome, quantidade, origem) {
    if (!nome || nome.trim() === "") return;
    
    console.log(`Tentando adicionar: ${nome} (${quantidade}x) de ${origem}`);
    
    if (itensMap.has(nome)) {
      const qtdAtual = itensMap.get(nome);
      itensMap.set(nome, qtdAtual + quantidade);
      console.log(`${nome}: quantidade atualizada para ${qtdAtual + quantidade}`);
    } else {
      itensMap.set(nome, quantidade);
      console.log(`${nome}: adicionado ${quantidade}x`);
    }
    
    produtosJaAdicionados.add(nome);
  }

  // Processar dispositivo
  const dispositivo = getDisplayValue(pedido.Dispositivo);
  if (dispositivo) {
    aplicarConversao(dispositivo).forEach(nome =>
      addProduto(nome, parseInt(pedido.Quantidade_de_Dispositivos || 1), "Dispositivo")
    );
  }

  // Processar chicote
  const chicote = getDisplayValue(pedido.Chicote);
  if (chicote) {
    //  Se não há dispositivo, usar quantidade de acessórios
    const quantidadeChicote = dispositivo 
      ? parseInt(pedido.Quantidade_de_Dispositivos || 1)
      : parseInt(pedido.Quantidade_de_Acess_rios || 1);
    
    aplicarConversao(chicote).forEach(nome =>
      addProduto(nome, quantidadeChicote, "Chicote")
    );
  }

  // Processar acessórios (ignorar duplicados)
  const acessorios = getDisplayValue(pedido.Acessorios);
  if (acessorios && acessorios !== "") {
    const produtosAcessorio = aplicarConversao(acessorios);
    
    produtosAcessorio.forEach(nome => {
      if (produtosJaAdicionados.has(nome)) {
        console.log(`⚠️ ${nome} já incluído no chicote - IGNORANDO acessório duplicado`);
        return;
      }
      addProduto(nome, parseInt(pedido.Quantidade_de_Acess_rios || 1), "Acessório");
    });
  }

  // Validar produtos
  if (itensMap.size === 0) {
    throw new Error(`Nenhum produto válido encontrado no pedido ${pedido.ID}`);
  }

  console.log(`✅ Produtos finais:`, Array.from(itensMap.entries()));

  // Montar estrutura de produtos para NF-e
  const ufEmitente = defaults.emit.enderEmit.UF;

  return Array.from(itensMap.entries()).map(([nome, quantidade]) => {
    const prod = buscarProduto(nome, produtosCatalogo);
    if (!prod) throw new Error(`Produto não encontrado: ${nome}`);
    
    const preco = parseFloat(prod["Preço Venda Varejo"]);
    const cfop = destinatario.Estado === ufEmitente ? "5908" : "6908";

    return {
      prod: {
        cProd: prod["﻿Código de Barras"] || prod["Código Interno"] || nome,
        cEAN: "SEM GTIN",
        xProd: prod["Descrição"],
        NCM: prod["NCM"],
        CFOP: cfop,
        uCom: defaults.prodDefaults.uCom,
        qCom: quantidade,
        vUnCom: parseFloat(preco.toFixed(2)),
        vProd: parseFloat((quantidade * preco).toFixed(2)),
        cEANTrib: "SEM GTIN",
        uTrib: defaults.prodDefaults.uCom,
        qTrib: quantidade,
        vUnTrib: parseFloat(preco.toFixed(2)),
        indTot: parseInt(defaults.prodDefaults.indTot)
      },
      imposto: {
        ICMS: {
          ICMS00: {
            orig: parseInt(defaults.prodDefaults.orig),
            CST: defaults.prodDefaults.CST,
            modBC: 3,
            vBC: 0.00,
            pICMS: 0.00,
            vICMS: 0.00
          }
        },
        PIS: {
          PISAliq: { CST: "01", vBC: 0.00, pPIS: 0.00, vPIS: 0.00 }
        },
        COFINS: {
          COFINSAliq: { CST: "01", vBC: 0.00, pCOFINS: 0.00, vCOFINS: 0.00 }
        }
      }
    };
  });
}

module.exports = { normalizarProdutos };