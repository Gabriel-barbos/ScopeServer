const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');

// Configurações da API
const API_CONFIG = {
  baseUrl: 'https://live.mzoneweb.net/mzone62.api',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NjA5ODU1MTQsImV4cCI6MTc2MDk4OTExNCwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiMTY3YThhODEtNjYwMy00OGRmLTg3MDEtZTk5Njg0MTc5ZmYyIiwiYXV0aF90aW1lIjoxNzYwOTg1NTE0LCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoibG1mYWRtc2NvcGUiLCJtel91c2VyZ3JvdXBfaWQiOiJkZGZiMzY0YS01NTU0LTQyYWYtYjgyZC1kYTlmZGE0ZWM1ZjciLCJtel9zaGFyZF9jb2RlIjoiQlJBWklMIiwic2NvcGUiOlsibXpfdXNlcm5hbWUiLCJvcGVuaWQiLCJkaS1hcGkuYWxsIiwibXo2LWFwaS5hbGwiXSwiYW1yIjpbInB3ZCJdfQ.lgfEDi7oIDcP2-WTEC3SqsXJcN_7LEs3fN35NJ4W1h84w4KIbMU2J-LoKmUkjbMLnKdmRYPA8sBg0o6cONq4q8araePH_QqKttMmO2L52NwK7FkeQoTz9tv6P-ZnM6FDw3th35PCjPonc30la8OxNoKgcDJwxnkq2TT4KUqbdber9Nz9MsGfDIbJrdt0XxnFjrl4GmULLhIBYqHezdLy5FxUqeYKzUmnhqKMZ_jkOz6ystdVap7T85nfFh2S-iZf063nNJC_hHBmvO8Nr4QRrrFCt8RXkbyrSugtQaynU1BhRlUyXvlzvyUQ-Ze6c0u3cjpXUm49VvMNg9JochIa7vaMYoka58D0z06nxBAV0QctnnFyUFbDNuL2wtIyiG7h6BmYaC0--WFv91_PAHPq0Cme6871P7VoQlJfgNkKEZLh0vKY5x9q8huev4GgnGQkAiIoqDs8ddiE-5lUJOx2ILwmGs-KrlxmNzO1Hl3yIUitClIRJw_yWYAL5MhWz9pDXskjQ-dw6MwmzWWXlMwSPTESXMmuRyi9Tg8n8V06XJzVuHH3RhF49Y2m90F61eEiGGFHAkLp4Sss14TvfSHeHqKNWQjhJBAIV4FAJtflwQG-1MLOpvsYv5SvqYeuN4LFYE2hTPH5OQctLKs3xBtN0mNFHaO8J886qm-nqsZD3Nk', 
    'Content-Type': 'application/json'
  }
};

// Função para buscar todos os veículos com paginação
async function buscarTodosVeiculos() {
  console.log('Iniciando busca de veículos...');
  let todosVeiculos = [];
  let skip = 0;
  const top = 10000; // Quantidade por página
  let temMaisDados = true;

  while (temMaisDados) {
    try {
      const url = `${API_CONFIG.baseUrl}/Vehicles?$top=${top}&$skip=${skip}`;
      console.log(`Buscando veículos: skip=${skip}, top=${top}`);
      
      const response = await axios.get(url, { headers: API_CONFIG.headers });
      
      const veiculos = response.data.value || [];
      todosVeiculos = todosVeiculos.concat(veiculos);
      
      console.log(`Recebidos: ${veiculos.length} veículos. Total acumulado: ${todosVeiculos.length}`);
      
      // Se recebeu menos que o esperado, não há mais dados
      if (veiculos.length < top) {
        temMaisDados = false;
      } else {
        skip += top;
      }
      
      // Pequeno delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Erro ao buscar veículos (skip=${skip}):`, error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Dados:', error.response.data);
      }
      throw error;
    }
  }
  
  console.log(`\nTotal de veículos obtidos: ${todosVeiculos.length}`);
  return todosVeiculos;
}

// Função para ler chassis do Excel
function lerChassisDoExcel(caminhoArquivo) {
  console.log(`\nLendo arquivo Excel: ${caminhoArquivo}`);
  
  const workbook = XLSX.readFile(caminhoArquivo);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const dados = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Assume que os chassis estão na primeira coluna
  // Remove a primeira linha se for cabeçalho
  const chassis = dados
    .slice(1) // Pula a primeira linha (cabeçalho)
    .map(row => row[0]) // Pega a primeira coluna
    .filter(chassi => chassi && chassi.toString().trim() !== ''); // Remove vazios
  
  console.log(`Total de chassis para verificar: ${chassis.length}`);
  return chassis;
}

// Função para comparar chassis
function compararChassis(veiculos, chassisParaVerificar) {
  console.log('\nIniciando comparação...');
  
  // Criar Set com todos os VINs do sistema para busca rápida
  const vinsNoSistema = new Set(
    veiculos.map(v => v.vin ? v.vin.toString().trim().toUpperCase() : '')
  );
  
  const resultados = chassisParaVerificar.map(chassi => {
    const chassiNormalizado = chassi.toString().trim().toUpperCase();
    const encontrado = vinsNoSistema.has(chassiNormalizado);
    
    return {
      Chassi: chassi,
      Status: encontrado ? 'ENCONTRADO' : 'NÃO ENCONTRADO'
    };
  });
  
  const encontrados = resultados.filter(r => r.Status === 'ENCONTRADO').length;
  const naoEncontrados = resultados.filter(r => r.Status === 'NÃO ENCONTRADO').length;
  
  console.log(`\nResultados da comparação:`);
  console.log(`  - Encontrados: ${encontrados}`);
  console.log(`  - Não encontrados: ${naoEncontrados}`);
  
  return resultados;
}

// Função para gerar planilha de resultado
function gerarPlanilhaResultado(resultados, caminhoSaida) {
  console.log(`\nGerando planilha de resultado: ${caminhoSaida}`);
  
  const worksheet = XLSX.utils.json_to_sheet(resultados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultado');
  
  XLSX.writeFile(workbook, caminhoSaida);
  console.log('Planilha gerada com sucesso!');
}

// Função principal
async function main() {
  try {
    console.log('=== INICIANDO PROCESSO DE COMPARAÇÃO DE CHASSIS ===\n');
    
    // 1. Buscar todos os veículos da API
    const veiculos = await buscarTodosVeiculos();
    
    // Opcional: Salvar dados dos veículos em JSON para análise
    fs.writeFileSync('veiculos_completos.json', JSON.stringify(veiculos, null, 2));
    console.log('Dados dos veículos salvos em: veiculos_completos.json');
    
    // 2. Ler chassis do Excel
    const chassisParaVerificar = lerChassisDoExcel('chassis_para_verificar.xlsx');
    
    // 3. Comparar
    const resultados = compararChassis(veiculos, chassisParaVerificar);
    
    // 4. Gerar planilha de resultado
    gerarPlanilhaResultado(resultados, 'resultado_comparacao.xlsx');
    
    console.log('\n=== PROCESSO CONCLUÍDO COM SUCESSO ===');
    
  } catch (error) {
    console.error('\n=== ERRO NO PROCESSO ===');
    console.error(error);
    process.exit(1);
  }
}

// Executar
main();