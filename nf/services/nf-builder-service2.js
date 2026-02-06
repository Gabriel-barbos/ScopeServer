const fs = require("fs");
const path = require("path");
const { loadJSON, sanitizeFilename } = require('./utils');
const { montarDestinatario } = require('./nf-destinatario');
const { normalizarProdutos } = require('./nf-produto');

const produtosCatalogo = loadJSON("../data/produtos.json");
const defaults = loadJSON("../data/default.json");

function gerarNF(pedido) {
  const { destinatario, ultimaNotaNumero } = pedido;

  if (!destinatario) throw new Error("Destinatário não fornecido no pedido");
  if (ultimaNotaNumero === undefined || ultimaNotaNumero === null) 
    throw new Error("Número da última nota (ultimaNotaNumero) é obrigatório");

  const nomeCliente = pedido.Cadastro_Cliente?.display_value || destinatario.Nome;
  if (!nomeCliente) throw new Error("Nome do cliente não encontrado");

  const dest = montarDestinatario(destinatario, defaults);
  const produtos = normalizarProdutos(pedido, destinatario, produtosCatalogo, defaults);

  const vTotalProd = parseFloat(
    produtos.reduce((acc, p) => acc + p.prod.vProd, 0).toFixed(2)
  );

  const nf = {
    ambiente: "producao",
    infNFe: {
      versao: "4.00",
      ide: {
        cUF: parseInt(defaults.ide.cUF),
        natOp: defaults.ide.natOp,
        mod: parseInt(defaults.ide.mod),
        serie: parseInt(defaults.ide.serie),
        nNF: parseInt(ultimaNotaNumero) + 1,
        dhEmi: new Date().toISOString(),
        tpNF: parseInt(defaults.ide.tpNF),
        idDest: destinatario.Estado === defaults.emit.enderEmit.UF ? 1 : 2,
        cMunFG: parseInt(defaults.ide.cMunFG),
        tpImp: parseInt(defaults.ide.tpImp),
        tpEmis: parseInt(defaults.ide.tpEmis),
        finNFe: parseInt(defaults.ide.finNFe),
        indFinal: (destinatario.CPF || !destinatario.CNPJ) ? 1 :
          (dest.indIEDest === 9 ? 1 : parseInt(defaults.ide.indFinal)),
        indPres: parseInt(defaults.ide.indPres),
        indIntermed: 0,
        procEmi: parseInt(defaults.ide.procEmi),
        verProc: defaults.ide.verProc,
        tpAmb: parseInt(defaults.ide.tpAmb)
      },
      emit: {
        CNPJ: defaults.emit.CNPJ,
        xNome: defaults.emit.xNome,
        IE: defaults.emit.IE,
        CRT: parseInt(defaults.emit.CRT),
        enderEmit: {
          ...defaults.emit.enderEmit,
          nro: defaults.emit.enderEmit.nro,
          cMun: parseInt(defaults.emit.enderEmit.cMun),
          cPais: parseInt(defaults.emit.enderEmit.cPais)
        }
      },
      dest,
      det: produtos.map((p, i) => {
        const impostoCompleto = {
          ...p.imposto,
          IBSCBS: p.imposto.IBSCBS || {
            CST: "000",
            cClassTrib: "000001",
            gIBSCBS: {
              vBC: 0.00,
              gIBSUF: {
                pIBSUF: 0.00,
                vIBSUF: 0.00
              },
              gIBSMun: {
                pIBSMun: 0.00,
                vIBSMun: 0.00
              },
              vIBS: 0.00,
              gCBS: {
                pCBS: 0.00,
                vCBS: 0.00
              }
            }
          }
        };

        return {
          nItem: i + 1,
          prod: p.prod,
          imposto: impostoCompleto
        };
      }),
      total: {
        ICMSTot: {
          vBC: 0.00,
          vICMS: 0.00,
          vICMSDeson: 0.00,
          vFCP: 0.00,
          vBCST: 0.00,
          vST: 0.00,
          vFCPST: 0.00,
          vFCPSTRet: 0.00,
          vProd: vTotalProd,
          vFrete: 0.00,
          vSeg: 0.00,
          vDesc: 0.00,
          vII: 0.00,
          vIPI: 0.00,
          vIPIDevol: 0.00,
          vPIS: 0.00,
          vCOFINS: 0.00,
          vOutro: 0.00,
          vNF: vTotalProd,
          vTotTrib: 0.00
        },
        IBSCBSTot: {
          vBCIBSCBS: 0.00,
          gIBS: {
            gIBSUF: {
              vDif: 0.00,
              vDevTrib: 0.00,
              vIBSUF: 0.00
            },
            gIBSMun: {
              vDif: 0.00,
              vDevTrib: 0.00,
              vIBSMun: 0.00
            },
            vIBS: 0.00,
            vCredPres: 0.00,
            vCredPresCondSus: 0.00
          },
          gCBS: {
            vDif: 0.00,
            vDevTrib: 0.00,
            vCBS: 0.00,
            vCredPres: 0.00,
            vCredPresCondSus: 0.00
          },
          gMono: {
            vIBSMono: 0.00,
            vCBSMono: 0.00,
            vIBSMonoReten: 0.00,
            vCBSMonoReten: 0.00, 
            vIBSMonoRet: 0.00,
            vCBSMonoRet: 0.00
          }
        }
      },
      transp: {
        modFrete: parseInt(defaults.transp.modFrete)
      },
      pag: {
        detPag: [
          {
            indPag: parseInt(defaults.pag.detPag[0].indPag),
            tPag: defaults.pag.detPag[0].tPag,
            vPag: defaults.pag.detPag[0].tPag === "90" ? 0.00 : vTotalProd
          }
        ]
      },
      infAdic: {
        ...defaults.infAdic,
        infCpl: `Nota emitida para envio ao cliente: ${nomeCliente}`
      }
    }
  };

 salvarArquivoTeste(nf, pedido);
  return nf;
}

function salvarArquivoTeste(nf, pedido) {
  try {
    const clienteNome = pedido.Cadastro_Cliente?.display_value || "Cliente";
    const clienteSanitizado = sanitizeFilename(clienteNome);

    const outputDir = path.join(__dirname, "../saida", clienteSanitizado);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const baseNome = pedido.Sub_Cliente?.display_value || pedido.Nome || "NF";
    const nomeArquivo = `${sanitizeFilename(baseNome)}_${Date.now()}.json`;
    const filePath = path.join(outputDir, nomeArquivo);

    fs.writeFileSync(filePath, JSON.stringify(nf, null, 2));
    console.log(`✅ [TESTE] NF gerada: ${filePath}`);
  } catch (error) {
    console.warn("⚠️ Erro ao salvar arquivo de teste:", error.message);
  }
}

module.exports = { gerarNF };