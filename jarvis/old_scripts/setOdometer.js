const axios = require('axios');
const readline = require('readline');

const API_URL = "https://live.mzoneweb.net/mzone62.api";
const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NjkxMDk5ODYsImV4cCI6MTc2OTExMzU4NiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiZjAwYWVjNjEtMzE2Zi00MTU1LWExZWUtOWQzYzAzM2JiYWYyIiwiYXV0aF90aW1lIjoxNzY5MTA5OTg2LCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiVW5pZGFzYWRtIiwibXpfdXNlcmdyb3VwX2lkIjoiYTA4ZDMyOTctODQ5Yi00MzEzLTg0MDktNWUxODQwODZkMDIyIiwibXpfc2hhcmRfY29kZSI6IkJSQVpJTCIsInNjb3BlIjpbIm16X3VzZXJuYW1lIiwib3BlbmlkIiwiZGktYXBpLmFsbCIsIm16Ni1hcGkuYWxsIl0sImFtciI6WyJwd2QiXX0.MPgGWA9_Y1gxgHtXN9dfYyIeXDIC8OqUNQEq8WD7_3csqhtdBrxs914fJA7pePRpPWvT_k3YorWSGG_osDmYn1pEYoimvQ7bDb2LzgN2Wt_WuXZo29tXpn6kFvK2iXwokbDemOuLNC2PEY1iWLfGJTDh9PezgBPophlysuUKNkNUuoZyBrfYbg1HeM0ym71T7MqXlIe57nRr2p3-jMq4Gvj7xSm3zkUPdvZN5chrIie0SbIwqbhxI2duPdFGq_3vNgLoCKWZh2PPocpN_HyAEsPKA00eYMRMDU-OfyE2dZDG5RALMd8GZBtm8k_lbHDlaNdJDEB29Eh14rq7HNZou9WVEIIPEIjFpROYg9ml20YmW2thn1avI36wKRjD0XXPHNX28Cju_Ah6WfejakuN-dYn7Koq96VpvU9B9-t2IYMdv0jl2cCWLt_aGXsoS1h6jb5USq_XTbha1xA0fCmOP4wgrAjV6b-V3mmKjv5dtEq6M_UWiw_aWDUXSx9OHsu7UdI6_YJFDOI7Ob3Ip9x_d08qOSNsZuMKqQRrDzQJX6pE4kPrgYzX_naEqYQ39-0qDj9Z8QC_2Tt9wYOPwBJWqUZsHY3i30JxoQNAhgqpzsy936SDvcxMad2GXKeRRhjD13nsoCggktQ4PtWw2PLmQqeVQqWGUFkscMHtzxXaxu8"; 

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

// Busca veículo por VIN ou unit_description
async function buscarVeiculo(identifier, type = 'vin') {
  try {
    const safeValue = sanitizeODataString(identifier);
    const filterField = type === 'vin' ? 'vin' : 'unit_Description';
    
    const res = await api.get(
      `/Vehicles?$filter=${filterField} eq '${safeValue}'&$select=id,description,vin,unit_Description`
    );

    const vehicles = res.data.value || [];
    return vehicles.length > 0 ? vehicles[0] : null;
  } catch (err) {
    console.error(` Erro ao buscar veículo (${identifier}):`, err.response?.data || err.message);
    return null;
  }
}

// Ajusta o odômetro do veículo
async function ajustarOdometro(vehicleId, odometerValue, vin) {
  try {
    const payload = {
      vehicle_Id: vehicleId,
      startUtcTimestamp: null,
      decimalOdometer: 0,
      decimalOdometerAdjustment: parseFloat(odometerValue),
      decimalOdometerUserProvidedValue: parseFloat(odometerValue),
      decimalOdometerAdjustmentEventUtcTimestamp: new Date().toISOString()
    };

    await api.post('/DeviceOdometerAdjustments', payload);

    console.log(` Odômetro ajustado para veículo ${vin}`);
    console.log(`   Vehicle ID: ${vehicleId}`);
    console.log(`   Valor: ${odometerValue} km\n`);
    return true;
  } catch (err) {
    console.error(` Erro ao ajustar odômetro (${vin}):`, err.response?.data || err.message);
    return false;
  }
}

// Processa a lista de veículos
async function processarLista(veiculos) {
  console.log(`\n Iniciando ajuste de odômetro para ${veiculos.length} veículos...\n`);
  
  let sucessos = 0;
  let falhas = 0;
  let naoEncontrados = 0;

  for (const item of veiculos) {
    const { chassi, odometro } = item;
    
    if (!chassi || !odometro) {
      console.log(` Dados inválidos: chassi=${chassi}, odometro=${odometro}\n`);
      falhas++;
      continue;
    }

    console.log(` Processando: ${chassi} | Odômetro: ${odometro}`);
    
    // Tenta buscar por VIN primeiro
    let veiculo = await buscarVeiculo(chassi, 'vin');
    
    // Se não encontrar, tenta por unit_description
    if (!veiculo) {
      console.log(`   ℹ  Não encontrado por VIN, tentando por unit_description...`);
      veiculo = await buscarVeiculo(chassi, 'unit_description');
    }
    
    if (!veiculo) {
      console.log(` Veículo não encontrado: ${chassi}\n`);
      naoEncontrados++;
      continue;
    }

    const resultado = await ajustarOdometro(veiculo.id, odometro, chassi);
    
    if (resultado) {
      sucessos++;
    } else {
      falhas++;
    }

    // Delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n RESUMO:");
  console.log(`    Sucessos: ${sucessos}`);
  console.log(`    Falhas: ${falhas}`);
  console.log(`     Não encontrados: ${naoEncontrados}`);
  console.log(`    Total processado: ${veiculos.length}\n`);
}

// Entrada via terminal (formato: CHASSI,ODOMETRO)
async function lerDoTerminal() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("\n  Cole os dados do Excel no formato: CHASSI,ODOMETRO");
  console.log("   Exemplo: 3VVSS65N3RM113673,15000");
  console.log("   Cole várias linhas e pressione ENTER em uma linha vazia quando terminar.\n");

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
      const veiculos = lines
        .filter(line => line.includes(','))
        .map(line => {
          const [chassi, odometro] = line.split(',').map(s => s.trim());
          return { chassi, odometro };
        });
      resolve(veiculos);
    });
  });
}

// Parser para formato Excel copiado (separado por TAB)
function parseExcelData(input) {
  return input
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      // Suporta tanto vírgula quanto TAB (Excel)
      const separator = line.includes('\t') ? '\t' : ',';
      const [chassi, odometro] = line.split(separator).map(s => s.trim());
      return { chassi, odometro };
    });
}

// Execução principal
async function main() {
  try {
    // OPÇÃO 1: Lista direto no código
    // const veiculos = [
    //   { chassi: "3VVSS65N3RM113673", odometro: "15000" },
    //   { chassi: "ABC123", odometro: "20000" },
    // ];

    // OPÇÃO 2: Ler do terminal
    const veiculos = await lerDoTerminal();

    if (veiculos.length === 0) {
      console.log("⚠️  Nenhum veículo fornecido!");
      return;
    }

    await processarLista(veiculos);
  } catch (err) {
    console.error(" Erro fatal:", err);
  }
}

main();