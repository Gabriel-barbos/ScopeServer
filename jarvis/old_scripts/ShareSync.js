import axios from 'axios';
import XLSX from 'xlsx';
import path from 'path';

const API_BASE = 'https://live.mzoneweb.net/mzone62.api';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NjA2Mzc0MjMsImV4cCI6MTc2MDY0MTAyMywiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiYmQ3OTM0MGQtNGNlNS00YWM4LTkwOGUtM2Q1NmJlM2UxZGM2IiwiYXV0aF90aW1lIjoxNzYwNjM3NDIzLCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiYnJhemlsLXN1cHBvcnRAc2NvcGV0ZWNobm9sb2d5LmNvbSIsIm16X3VzZXJncm91cF9pZCI6ImM1NTk3Y2NhLTRiM2MtNDk0MS05MGE1LTI1NWY2OTA4ODYyNyIsIm16X3NoYXJkX2NvZGUiOiJCUkFaSUwiLCJzY29wZSI6WyJtel91c2VybmFtZSIsIm9wZW5pZCIsImRpLWFwaS5hbGwiLCJtejYtYXBpLmFsbCJdLCJhbXIiOlsicHdkIl19.da9rlJt4oiQHuT77TCeVc64gn65-Q2ldkrc3j1jBJLWrDiF4ansTecnwyZVVZLF8VNH7X_5SHP23Lu1Pd2iXnPNe0m1JGR0vmQ8HgruNE3tG5vtwzquhKgXe6uGT0SnfSrAMprO35wDdShP70Z7nlSrsihKYcqA_BPwFF5d0zuxRnqA5B4rzR8j7BwDkYwdjsEa96c_6ufKdrM2eJOYTU5uO438sq7mgsxmdz8v5yrIgpNNjWEh64KR88yL3QqHPiWBJoLcTk96NPgsHIqj0FMClIYVOa1oirPRPr2mKUPLygRFBCoBSb-N3QTK6rT_dgI1enmycOzRGf3bPvAvdXf7vgYikI3I9j-3XOgg_F5MJ_X2-dDpLMC4LNMxlwTCB2WfXu5NxsBZbH4z_5W0U8I3bpMo63uTBlZEQXNFjrsGxpiXnV1-SxXUBZl5uRolOhdT5oAJJ8mLIOlWRzB1zMZCU4EIIL5mGS4u9d0a_f_8Np_Sl8h19QpLfKEUKHM8QJyWNXJT5mAXeEpER3jMZg0r7Pl-DmT82CXFl8CIrGGKPqEDehS2kGfJclz_8WjFDWnIp4YS6jKzAKztg_f22I772-ahg-fXT5tbNNkGmBGPsiKbWNuYz4xRkrk2TuxcDmX89lclLvkiCZ4ZJFiYbhyyJDuRG8DMbfNfYsXc_RXY'
// caminho do excel
const EXCEL_FILE = path.resolve('share.xlsx');

// 1. Ler Excel
function readExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  return data.slice(1); // remove cabeçalho
}

// 2. Buscar veículo por description
async function getVehicleIdByDescription(description) {
  console.log(`🔎 Buscando veículo com description: "${description}"...`);
  const url = `${API_BASE}/Vehicles?$filter=vin eq '${description}'&$select=id,description`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (response.data.value.length === 0) {
      console.log(`❌ Nenhum veículo encontrado para "${description}"`);
      return null;
    }

    const vehicleId = response.data.value[0].id;
    console.log(`✅ ID do veículo encontrado: ${vehicleId}`);
    return vehicleId;
  } catch (err) {
    console.error('❌ Erro na busca de veículo:', err.response?.data || err.message);
    return null;
  }
}

// 3. Buscar VehicleShareManagement pelo vehicleId
async function getVehicleShareManagementId(vehicleId) {
  const url = `${API_BASE}/VehicleShareManagement?$filter=vehicle_Id eq ${vehicleId}&$select=id,vehicle_Id,shareSynchronizationType`;

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (response.data.value.length === 0) {
      console.log(`❌ Nenhum VehicleShareManagement encontrado para vehicleId: ${vehicleId}`);
      return null;
    }

    const vsmId = response.data.value[0].id;
    console.log(`✅ VehicleShareManagement ID encontrado: ${vsmId}`);
    return vsmId;
  } catch (err) {
    console.error('❌ Erro ao buscar VehicleShareManagement:', err.response?.data || err.message);
    return null;
  }
}

// 4. Atualizar shareSynchronizationType = 1
async function setShareSync(vsmId) {
  const url = `${API_BASE}/VehicleShareManagement(${vsmId})`;
  const body = { shareSynchronizationType: 1 };

  try {
    await axios.patch(url, body, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`✅ shareSynchronizationType atualizado para 1 (sync) em ${vsmId}`);
  } catch (err) {
    console.error(`❌ Erro ao atualizar sync em ${vsmId}:`, err.response?.data || err.message);
  }
}

// 5. Fluxo principal
async function main() {
  const rows = readExcel(EXCEL_FILE);

  for (const row of rows) {
    const description = row[0]?.toString().trim();
    if (!description) {
      console.log('⚠️ Linha inválida, pulando:', row);
      continue;
    }

    console.log('\n=============================');
    console.log(`Processando veículo: ${description}`);

    const vehicleId = await getVehicleIdByDescription(description);
    if (!vehicleId) continue;

    const vsmId = await getVehicleShareManagementId(vehicleId);
    if (!vsmId) continue;

    await setShareSync(vsmId);
  }

  console.log('\n✅ Processamento finalizado!');
}

main();
