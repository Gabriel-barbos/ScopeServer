const { gerarNF } = require('../services/nf-builder-service');
const { emitirNFe, buscarPDF } = require('../services/nuvemfiscal');
const NotaFiscal = require('../models/Nota');


async function emitirNota(req, res) {
  try {
    const dadosPedido = req.body;

    if (!dadosPedido.destinatario) {
      return res.status(400).json({
        sucesso: false,
        erro: "Destinatário é obrigatório"
      });
    }

    if (dadosPedido.ultimaNotaNumero === undefined || dadosPedido.ultimaNotaNumero === null) {
      return res.status(400).json({
        sucesso: false,
        erro: "ultimaNotaNumero é obrigatório"
      });
    }

    console.log("📋 Gerando JSON da NF-e...");
    const jsonNF = gerarNF(dadosPedido);

    console.log("📤 Enviando para Nuvem Fiscal...");
    const resultado = await emitirNFe(jsonNF);

    if (!resultado.sucesso) {
      return res.status(422).json({
        sucesso: false,
        erro: resultado.motivoErro || "NF-e rejeitada pela SEFAZ",
        detalhes: {
          status: resultado.status,
          numero: resultado.numero,
          chave: resultado.chave,
          codigoErro: resultado.codigoErro,
          motivoErro: resultado.motivoErro
        }
      });
    }

    console.log("📄 Buscando PDF...");
    const pdfBuffer = await buscarPDF(resultado.eventoId);

    const dadosResposta = {
      sucesso: true,
      mensagem: "NF-e autorizada com sucesso!",
      dados: {
        numero: resultado.numero,
        chave: resultado.chave,
        protocolo: resultado.protocolo,
        eventoId: resultado.eventoId,
        dataAutorizacao: resultado.dataAutorizacao,
        valorTotal: jsonNF.infNFe.total.ICMSTot.vNF,
        destinatario: jsonNF.infNFe.dest.xNome,
        pdf: pdfBuffer.toString('base64')
      }
    };

    res.status(200).json(dadosResposta);

    // Salvar no banco após resposta
    setImmediate(async () => {
      try {
        await NotaFiscal.create({
          numero: resultado.numero,
          eventoId: resultado.eventoId,
          dataAutorizacao: resultado.dataAutorizacao,
          protocolo: resultado.protocolo,
          destinatario: jsonNF.infNFe.dest.xNome
        });
        console.log("✅ Nota salva no banco");
      } catch (err) {
        console.error("❌ Erro ao salvar nota:", err.message);
      }
    });

  } catch (error) {
    console.error("❌ Erro ao emitir NF-e:", error);
    res.status(500).json({
      sucesso: false,
      erro: "Erro ao processar emissão da NF-e",
      detalhes: error.message
    });
  }
}

/**
 * Busca PDF de uma NF-e já autorizada
 */
async function buscarPDFNota(req, res) {
  try {
    const { eventoId } = req.params;

    if (!eventoId) {
      return res.status(400).json({
        sucesso: false,
        erro: "eventoId é obrigatório"
      });
    }

    console.log(`📄 Buscando PDF do evento: ${eventoId}`);
    const pdfBuffer = await buscarPDF(eventoId);

    res.status(200).json({
      sucesso: true,
      eventoId,
      pdf: pdfBuffer.toString('base64'),
      mimeType: 'application/pdf'
    });

  } catch (error) {
    console.error("❌ Erro ao buscar PDF:", error);
    res.status(500).json({
      sucesso: false,
      erro: "Erro ao buscar PDF da NF-e",
      detalhes: error.message
    });
  }
}

/**
 * Lista histórico de notas emitidas
 */
async function listarHistorico(req, res) {
  try {
    const notas = await NotaFiscal.find()
      .sort({ dataAutorizacao: -1 })
      .select('-__v');

    res.status(200).json({
      sucesso: true,
      total: notas.length,
      dados: notas
    });

  } catch (error) {
    console.error("❌ Erro ao buscar histórico:", error);
    res.status(500).json({
      sucesso: false,
      erro: "Erro ao buscar histórico de notas",
      detalhes: error.message
    });
  }
}

module.exports = {
  emitirNota,
  buscarPDFNota,
  listarHistorico
};