import axios from 'axios';
import XLSX from 'xlsx';
import path from 'path';

const API_BASE = 'https://live.mzoneweb.net/mzone62.api';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NTY5MjQ5MTQsImV4cCI6MTc1NjkyODUxNCwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiZjAwYWVjNjEtMzE2Zi00MTU1LWExZWUtOWQzYzAzM2JiYWYyIiwiYXV0aF90aW1lIjoxNzU2OTI0OTE0LCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiVW5pZGFzYWRtIiwibXpfdXNlcmdyb3VwX2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiwibXpfc2hhcmRfY29kZSI6IkJSQVpJTCIsInNjb3BlIjpbIm16X3VzZXJuYW1lIiwib3BlbmlkIiwiZGktYXBpLmFsbCIsIm16Ni1hcGkuYWxsIl0sImFtciI6WyJwd2QiXX0.TFP2TyWbkKdn3dKpGGN3aHTss6QIeYUyBlU60ykZbxFhtNl7KIabaauoKK0mxWbS9TNtd8N_lQ1EAQLmPpP032zcpAV7uAhAL2U1tUtZiE4IXpHKLwVGmvKlm146LgeK540TfIcMvLRN3ksf0aGjZ3hw6Lhp2_nYjw0QT9Jub_bIYNX7aIsm5jza-I5vKGSiXrc1Ma0zlQ2NTdiLNvxSyHdo5-1t_zXWRw39yWNx683UVrDr9S4IkJGzPjZEzHmAOw45gNLeuwC6FQUCOg76UOPpl-PvupFs3ZuKDt1qAWcunFf3Jg343y0GvTWOEEAoVkE89GY4Wqx6vhwTVTWMwurAQHaTqwqNfVhLLFvYgbnIZ7cHNKwq_es4Q_07fr1UexvNeClz74SMaHjsrPUe4v8fpRIsX4unmh25PE-6I1FTo3nxNSDujdOYPnaWUi9PpXSJDLUAAdUNI-CXgNJrMusODvnY8FRL7HVjEPp64OFVop9mgKHHuCEX859HzhS6czGbswLkqqwakKoYb7Vwhdg3Ut_d6xHms_rK2nW0diIeIblRD0jsgDtSgs7lxHCymAKDZY9Gdh935x6ezKJ1EVDO9V_w1tJSNz6sq7xSpwES7eOfb5n9jWbxIoku7XyoUEWyzk1eZa-PIxeILb8pqU3NI-md6bnmAwRwWSZbPx8'; 

const EXCEL_FILE = path.resolve('veiculos.xlsx'); 

//  ler o Excel
function readExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); 
  return data.slice(1); 
}

// Busca ID do carro pelo chassi
async function getVehicleIdByVin(vin) {
  console.log(` Buscando ID do veículo para VIN: ${vin}...`);
  const url = `${API_BASE}/Vehicles?$filter=vin eq '${vin}'&$select=id,vin`;

  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (response.data.value.length === 0) {
    console.log(`❌ Carro com VIN ${vin} não encontrado.`);
    return null;
  }

  const vehicleId = response.data.value[0].id;
  console.log(`✅ ID do veículo encontrado: ${vehicleId}`);
  return vehicleId;
}

// Busca ID do grupo pelo description
async function getVehicleGroupIdByDescription(description) {
  console.log(` Buscando ID do grupo de veículos: "${description}"...`);
  const url = `${API_BASE}/VehicleGroups?$filter=description eq '${description}'&$select=id,description`;

  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (response.data.value.length === 0) {
    console.log(`❌ Grupo "${description}" não encontrado.`);
    return null;
  }

  const groupId = response.data.value[0].id;
  console.log(`✅ ID do grupo encontrado: ${groupId}`);
  return groupId;
}

// Adiciona veículos ao grupo
async function addVehiclesToGroup(groupId, vehicleIds) {
  console.log(` Adicionando veículo(s) ao grupo ID: ${groupId}...`);
  const url = `${API_BASE}/VehicleGroups(${groupId})/_.addVehicles`;
  const body = { vehicleIds };

  try {
    const response = await axios.post(url, body, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    console.log(`✅ Veículo(s) adicionados com sucesso!`);
    return response.data;
  } catch (error) {
    console.log('❌ Erro ao adicionar veículo(s):', error.response?.data || error.message);
    return null;
  }
}

// Fluxo principal
async function main() {
  const rows = readExcel(EXCEL_FILE);

  for (const row of rows) {
    const vin = row[0]?.toString().trim();
    const groupDescription = row[1]?.toString().trim();

    if (!vin || !groupDescription) {
      console.log('⚠️ Linha inválida, pulando:', row);
      continue;
    }

    console.log('\n=============================');
    console.log(`Processando VIN: ${vin}, Grupo: ${groupDescription}`);

    const vehicleId = await getVehicleIdByVin(vin);
    if (!vehicleId) continue;

    const groupId = await getVehicleGroupIdByDescription(groupDescription);
    if (!groupId) continue;

    await addVehiclesToGroup(groupId, [vehicleId]);
  }

  console.log('\n✅ Processamento finalizado!');
}

main();