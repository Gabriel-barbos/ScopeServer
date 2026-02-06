const { gerarNF } = require('./nf-builder-service');

// ========================================
// DADOS MOCKADOS - Simula requisição do front-end
// ========================================

const pedidoMock = {
  ID: "PEDIDO-12345",
  ultimaNotaNumero: 13557, // OBRIGATÓRIO - Última nota emitida
  
  // Informações do cliente principal
  Cadastro_Cliente: {
    display_value: "CAOA"
  },
  
  // Sub-cliente (opcional)
  Sub_Cliente: {
    display_value: ""
  },
  
  // Produtos do pedido
  Dispositivo: {
    display_value: "GV50" // Exemplo - ajuste conforme seu sistema
  },
  Quantidade_de_Dispositivos: 1,
  
  Chicote: {
    display_value: "2G - Sem Bloqueio" // Exemplo
  },
  

  // Destinatário COMPLETO (vindo do banco de dados)
  destinatario: {
    Nome: "João Silva Transportes ME",
    CPF: "", // Vazio se for CNPJ
    CNPJ: "12345678000190",
    IE: "123456789", // Inscrição Estadual (opcional)
    Endereco: "Rua das Flores",
    Numero: "123",
    Complemento: "Sala 5",
    Bairro: "Centro",
    Cidade: "São Paulo",
    Estado: "SP",
    CEP: "01310100",
    Telefone: "1133334444",
    Celular: "11987654321"
  }
};

// ========================================
// TESTE 1: Pedido completo com CNPJ
// ========================================
console.log("=".repeat(60));
console.log("🧪 TESTE 1: Pedido com CNPJ e IE");
console.log("=".repeat(60));

try {
  const nf1 = gerarNF(pedidoMock);
  console.log("\n✅ NF gerada com sucesso!");
  console.log(`📄 Número da nota: ${nf1.infNFe.ide.nNF}`);
  console.log(`👤 Destinatário: ${nf1.infNFe.dest.xNome}`);
  console.log(`📋 CNPJ: ${nf1.infNFe.dest.CNPJ}`);
  console.log(`🏷️  Indicador IE: ${nf1.infNFe.dest.indIEDest} (1=Contribuinte, 9=Não Contribuinte)`);
  console.log(`📦 Total de produtos: ${nf1.infNFe.det.length}`);
  console.log(`💰 Valor total: R$ ${nf1.infNFe.total.ICMSTot.vNF}`);
  console.log(`📝 Info Adicional: ${nf1.infNFe.infAdic.infCpl}`);
  console.log("\n📋 Produtos na nota:");
  nf1.infNFe.det.forEach(item => {
    console.log(`   ${item.nItem}. ${item.prod.xProd} - Qtd: ${item.prod.qCom} - R$ ${item.prod.vProd}`);
  });
} catch (error) {
  console.error("\n❌ ERRO:", error.message);
}

// ========================================
// TESTE 2: Pedido com CPF (pessoa física)
// ========================================
console.log("\n" + "=".repeat(60));
console.log("🧪 TESTE 2: Pedido com CPF (Pessoa Física)");
console.log("=".repeat(60));

const pedidoCPF = {
  ...pedidoMock,
  ID: "PEDIDO-67890",
  ultimaNotaNumero: 13557, // Próxima nota
  destinatario: {
    Nome: "Janiel de Oliveira Barreto",
    CPF: "70886001102",
    CNPJ: "",
    IE: "",
    Endereco: "R. São José",
    Numero: "10",
    Complemento: "Travessa A casa 10",
    Bairro: "Embaré",
    Cidade: "Santos",
    Estado: "SP",
    CEP: "11040200",
    Telefone: "1133334444"
  }
};

try {
  const nf2 = gerarNF(pedidoCPF);
  console.log("\n✅ NF gerada com sucesso!");
  console.log(`📄 Número da nota: ${nf2.infNFe.ide.nNF}`);
  console.log(`👤 Destinatário: ${nf2.infNFe.dest.xNome}`);
  console.log(`📋 CPF: ${nf2.infNFe.dest.CPF}`);
  console.log(`🏷️  Indicador IE: ${nf2.infNFe.dest.indIEDest} (9=Não Contribuinte para CPF)`);
  console.log(`📝 Info Adicional: ${nf2.infNFe.infAdic.infCpl}`);
} catch (error) {
  console.error("\n❌ ERRO:", error.message);
}



console.log("\n" + "=".repeat(60));
console.log("✅ Testes finalizados! Verifique os arquivos em ../saida/");
console.log("=".repeat(60));