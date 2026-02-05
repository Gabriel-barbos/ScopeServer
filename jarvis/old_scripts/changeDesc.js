const axios = require('axios');
const readline = require('readline');

const API_URL = "https://live.mzoneweb.net/mzone62.api";
const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NjkxMDIyMzEsImV4cCI6MTc2OTEwNTgzMSwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiMTY3YThhODEtNjYwMy00OGRmLTg3MDEtZTk5Njg0MTc5ZmYyIiwiYXV0aF90aW1lIjoxNzY5MTAyMjMxLCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoibG1mYWRtc2NvcGUiLCJtel91c2VyZ3JvdXBfaWQiOiJkZGZiMzY0YS01NTU0LTQyYWYtYjgyZC1kYTlmZGE0ZWM1ZjciLCJtel9zaGFyZF9jb2RlIjoiQlJBWklMIiwic2NvcGUiOlsibXpfdXNlcm5hbWUiLCJvcGVuaWQiLCJkaS1hcGkuYWxsIiwibXo2LWFwaS5hbGwiXSwiYW1yIjpbInB3ZCJdfQ.SRVQKujsn_POC0LJMEsdm4v9ARmK3W_zfEgouDtYbz693jOyc5aVWcYRS8VfAIvANSAE7X4BJOrBA_fhcUWfqy5s_ZjocNTttQs-rIqJFVQ7AHfm4NJ28bl-99anEfjjmrQLLxf1ATjDFvGDsQJrdG3QoEgYTdCEbqhMkQaleqnMlfPUl3GnJ5D7f_AU0SWHzETLLDDYCl3bLnx1ZeAUrORc-C0Q40qT2WONTdmg98KzEVQ4kza37UbiOUxKYVH-K-k7m75lxGdmfhJ9qHrfyIUzZv7NRMkQjyNqtmWJclRPA6__LT5fbUI4HIM6FlnfGB9vVwuKel9lPLqTW6cKUK6yJylZYZpV6GvkzPqKXv2ls66LGIJig3LdS1NtoAyPsnCMIIfrlrVuN9HLNy0B-gWr9oQ5xnohZTUKNHBq_m25tAVJGYtEjXZOvwjzIbkB4ZufLr3be04ld8Uuop3uy04TvfGUvUPfbZBNZV3vY3dr8mwTjNPcOKqrx0cRuA52q7rVb84G4F-MC9fMvXTEKBOB0iqxqIa_0PfOLN77P_ecSqwDJYbm5RLa0o94gZNs-WeqMdd8ZIC6UgOc2x2I94DPGT5OBEOEIrV3719-8lLZsi6IwHhsy6MAMin_LO5oBOQq4c1rxp7WCvz95B_bzDai7mHvhcMOSu-e9CTwwbQ";
const api = axios.create({
  baseURL: API_URL,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
});

// Sanitiza strings para OData
function sanitizeODataString(str) {
  return str.replace(/'/g, "''");
}

// Busca veículo por unit_description
async function buscarVeiculo(unitDescription) {
  try {
    const safeValue = sanitizeODataString(unitDescription);
    
    const res = await api.get(
      `/Vehicles?$filter=unit_Description eq '${safeValue}'&$select=id,description,vin,unit_Description`
    );

    const vehicles = res.data.value || [];
    return vehicles.length > 0 ? vehicles[0] : null;
  } catch (err) {
    console.error(`❌ Erro ao buscar veículo (${unitDescription}):`, err.response?.data || err.message);
    return null;
  }
}

// Atualiza a tag do veículo
async function atualizarTag(vehicleId, currentDescription) {
  try {
    let novaDescricao = currentDescription;

    // Remove "DESATIVAÇÃO V " se existir
    if (currentDescription.startsWith("DESATIVAÇÃO V ")) {
      novaDescricao = currentDescription.replace(/^DESATIVAÇÃO V /, "");
    }

    // Adiciona "CANCELADO V " se ainda não tiver
    if (!novaDescricao.startsWith("CANCELADO V ")) {
      novaDescricao = `CANCELADO V ${novaDescricao}`;
    }

    // Se não houve mudança, pula
    if (novaDescricao === currentDescription) {
      console.log(`⏭️  Veículo ${vehicleId} já está com a tag correta`);
      return true;
    }

    await api.patch(`/Vehicles(${vehicleId})`, {
      description: novaDescricao,
    });

    console.log(`✅ Veículo ${vehicleId} atualizado`);
    console.log(`   DE: ${currentDescription}`);
    console.log(`   PARA: ${novaDescricao}\n`);
    return true;
  } catch (err) {
    console.error(`❌ Erro ao atualizar veículo ${vehicleId}:`, err.response?.data || err.message);
    return false;
  }
}

// Processa a lista de unit_descriptions
async function processarLista(unitDescriptions) {
  console.log(`\n🚗 Iniciando processamento de ${unitDescriptions.length} veículos...\n`);
  
  let sucessos = 0;
  let falhas = 0;
  let naoEncontrados = 0;

  for (const unitDesc of unitDescriptions) {
    const unitDescTrimmed = unitDesc.trim();
    
    if (!unitDescTrimmed) continue;

    console.log(`🔍 Buscando: ${unitDescTrimmed}`);
    
    const veiculo = await buscarVeiculo(unitDescTrimmed);
    
    if (!veiculo) {
      console.log(`⚠️  Veículo não encontrado: ${unitDescTrimmed}\n`);
      naoEncontrados++;
      continue;
    }

    const resultado = await atualizarTag(veiculo.id, veiculo.description);
    
    if (resultado) {
      sucessos++;
    } else {
      falhas++;
    }

    // Delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n📊 RESUMO:");
  console.log(`   ✅ Sucessos: ${sucessos}`);
  console.log(`   ❌ Falhas: ${falhas}`);
  console.log(`   ⚠️  Não encontrados: ${naoEncontrados}`);
  console.log(`   📝 Total processado: ${unitDescriptions.length}\n`);
}

// Entrada via terminal
async function lerDoTerminal() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("\n📋 Cole a lista de unit_descriptions (um por linha).");
  console.log("   Quando terminar, pressione ENTER em uma linha vazia.\n");

  const lines = [];
  
  rl.on('line', (line) => {
    if (line.trim() === '') {
      rl.close();
    } else {
      lines.push(line.trim());
    }
  });

  return new Promise((resolve) => {
    rl.on('close', () => {
      resolve(lines);
    });
  });
}

// Execução principal
async function main() {
  try {
    // OPÇÃO 1: Lista direto no código (descomente e adicione os valores)
    // const unitDescriptions = [
    //   "ABC123",
    //   "XYZ789",
    // ];

    // OPÇÃO 2: Ler do terminal
    const unitDescriptions = await lerDoTerminal();

    if (unitDescriptions.length === 0) {
      console.log("⚠️  Nenhum unit_description fornecido!");
      return;
    }

    await processarLista(unitDescriptions);
  } catch (err) {
    console.error("❌ Erro fatal:", err);
  }
}

main();