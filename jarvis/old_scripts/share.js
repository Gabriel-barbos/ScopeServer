import axios from 'axios';
import XLSX from 'xlsx';
import path from 'path';

const API_BASE = 'https://live.mzoneweb.net/mzone62.api';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NTgyMTkxMTgsImV4cCI6MTc1ODIyMjcxOCwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiYmQ3OTM0MGQtNGNlNS00YWM4LTkwOGUtM2Q1NmJlM2UxZGM2IiwiYXV0aF90aW1lIjoxNzU4MjE5MTE4LCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiYnJhemlsLXN1cHBvcnRAc2NvcGV0ZWNobm9sb2d5LmNvbSIsIm16X3VzZXJncm91cF9pZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsIm16X3NoYXJkX2NvZGUiOiJCUkFaSUwiLCJzY29wZSI6WyJtel91c2VybmFtZSIsIm9wZW5pZCIsImRpLWFwaS5hbGwiLCJtejYtYXBpLmFsbCJdLCJhbXIiOlsicHdkIl19.BJ1Vjr6pMdDiR1kR9XJbpidg5-oPFu4Ye_Kw8qCzbDOjCYDN7VPzkkIWNfkjnZY8vbOBnqQasMtSQ6MoTCH969QDp8pebbCP_QRv0FcMrvcCaPPXYi3Iebuszbf6VBBv4o87BYPDNN49xwXpGPoKw6sV2_P4Ju88aBEsJypZYUf43oM9sKNghAHltxHesDMSZturglY8HYwePIvQ722KUkXNw2APC1L3tvutnlsMP9ntdbmibzNhffHrKlcM0PUywQiqupAf2CyEJLpm92sQlW7FVut3kutdLsWVDfDCuLEQIVwfgry16UEDtZa9D1yppKDkRI9zEIa1MyehiPMSpbSPAkRUiEGa9FGLMWlM1HldDv9QUGbfGPjt4PBfPFhyNWqMHJNNDq6tL0Eqe_eGpW-Xx-fRZGryNXbjwsb96y3AhapCAe1WM7cL4l-Vzwr3BrWumY4BHIl1LWQnM7jIRnT049S0dXTB4i6Khv_I7DhFyBZhRNzLCLW-5BIAAOjXK24-ofxQfGxQQOC07y6EBId6S-hpSY0YsPrDgqDqdIKAYSsqcCpBEUo-YKy2jmeMl_us6RwRDNr0QgydbHzODQyksGqW5EIiMTF2n7xgsaOkRrVbpOxZGuQ61FRxr9k27jS-zmJPXDNTdWRdxoJrRQoUx-4ydNrByalWv4kiR68';

// o grupo alvo
const USER_GROUP_ID = 'ed8634a5-88b2-4b1a-81c9-c5388794ceec';

// caminho do excel
const EXCEL_FILE = path.resolve('share.xlsx');

// 1. Ler Excel
function readExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); 
  return data.slice(1); 
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
    console.log(`✅ ID encontrado: ${vehicleId}`);
    return vehicleId;
  } catch (err) {
    console.error('❌ Erro na busca:', err.response?.data || err.message);
    return null;
  }
}

// 3. Compartilhar veículo com grupo
async function shareVehicle(vehicleId) {
  const url = `${API_BASE}/VehicleShareManagement(${vehicleId})/_.share`;
  const body = {
    userGroupId: USER_GROUP_ID,
    shareInMiddleGroups: true,
    shareVehicleTypes: true
  };

  try {
    const response = await axios.post(url, body, {
      headers: { 
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
    });
    console.log(`✅ Veículo ${vehicleId} compartilhado com sucesso!`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro ao compartilhar veículo ${vehicleId}:`, error.response?.data || error.message);
    return null;
  }
}

// 4. Fluxo principal
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

    await shareVehicle(vehicleId);
  }

  console.log('\n✅ Processamento finalizado!');
}

main();
