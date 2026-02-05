import axios from "axios";
import fs from "fs";
import pkg from "xlsx";
const { readFile, utils } = pkg;

const API_URL = "https://live.mzoneweb.net/mzone62.api";
const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NjA5NjIzMjgsImV4cCI6MTc2MDk2NTkyOCwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiYmQ3OTM0MGQtNGNlNS00YWM4LTkwOGUtM2Q1NmJlM2UxZGM2IiwiYXV0aF90aW1lIjoxNzYwOTYyMzI4LCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiYnJhemlsLXN1cHBvcnRAc2NvcGV0ZWNobm9sb2d5LmNvbSIsIm16X3VzZXJncm91cF9pZCI6ImM1NTk3Y2NhLTRiM2MtNDk0MS05MGE1LTI1NWY2OTA4ODYyNyIsIm16X3NoYXJkX2NvZGUiOiJCUkFaSUwiLCJzY29wZSI6WyJtel91c2VybmFtZSIsIm9wZW5pZCIsImRpLWFwaS5hbGwiLCJtejYtYXBpLmFsbCJdLCJhbXIiOlsicHdkIl19.BanUZzYntaqm9cCGi4Q-5CMoElpaT0Hu6wQow-PATEsCZEEOR8OQ85ra4e7iOLcARSWQHyI_8GJOLI07tKJUMtcPjpBUDm4Xi4I-vf12ywL1VdoLpmwnk9T4tmF7rPk6iGg5-UZN3rW7XyvCmiagrkDMYWcUHhCStFgIg6ulZMUw0VACoTqrrpCzXFcLnuvJdD17PXOTQ4aCNTD9dU0uf4KOONk6txdAZUmGFYjdGJ0wUMqlHt_5wh2GTta5g8aKm6L7qkXyPT8Cxeqc5Y_1aJFugLbXHUAUc31j9lYKCmaiX18LSFqDta4FHtl6PGLtM902LKDKhOYZykjAwWocAdWlwPuAJRYZduIjlcTFLO_31dBp2I6JMLKWwzDNNDyVW6JvAyut5vxaasUyBIuWYw4j5AnF1uenjW5noLuzCbp7jwmQUvZlWRALPiY-jLY2glvYBAd77gS5oeI54HGJGmzAaJh42RBViD-g0aWh2FtH6LRQHM5xKkkkFaujjWBYE-rZq_c7OrXz2BMO85O_Divlj7lQeDQT-HDQjRrugg4bNLkY5Za5MkRsudWVJvdAj5B28kGNUJjja30FUwZYIQ16DeHdpoxBrJkIr0JWTRUiaqysTfPC2UVJcnNUk_Sc5SIOmhV_E1KSEhBEY5BamAJ909_hnhzsAJm5mWhMaCY";

const gruposSeguranca = JSON.parse(fs.readFileSync("gruposSeguranca.json", "utf-8"));
const workbook = readFile("CARROS.xlsx");
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// ✅ Normaliza as chaves para minúsculo
const carros = utils.sheet_to_json(sheet).map((row) => {
  const normalizado = {};
  for (const chave in row) {
    normalizado[chave.toLowerCase()] = row[chave];
  }
  return normalizado;
});

async function buscarVeiculoPorVIN(vin) {
  try {
    console.log(`🔎 Buscando veículo VIN: ${vin}`);
    const url = `${API_URL}/Vehicles?$filter=vin eq '${vin}'&$select=id,vin`;
    const response = await axios.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } });

    if (response.data.value?.length > 0) {
      console.log(`✅ Veículo encontrado: ${response.data.value[0].id}`);
      return response.data.value[0].id;
    } else {
      console.warn(`⚠️ Veículo não encontrado para VIN: ${vin}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Erro ao buscar veículo VIN: ${vin}`);
    console.error(error.response?.data || error.message);
    return null;
  }
}

async function buscarGrupoPorDescricao(description) {
  try {
    console.log(`🔎 Buscando grupo "${description}"`);
    const url = `${API_URL}/VehicleGroups?$filter=description eq '${description}'&$select=id,description`;
    const response = await axios.get(url, { headers: { Authorization: `Bearer ${TOKEN}` } });

    if (response.data.value?.length > 0) {
      console.log(`✅ Grupo encontrado: ${response.data.value[0].id}`);
      return response.data.value[0].id;
    }
    console.log(`⚠️ Grupo não encontrado, será criado: ${description}`);
    return null;
  } catch (error) {
    console.error(`❌ Erro ao buscar grupo: ${description}`);
    console.error(error.response?.data || error.message);
    return null;
  }
}

async function criarGrupo(description, securityGroupId) {
  try {
    console.log(`🆕 Criando grupo: ${description}`);
    const response = await axios.post(
      `${API_URL}/VehicleGroups`,
      {
        description,
        securityGroupIds: [securityGroupId],
      },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`✅ Grupo criado com ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error(`❌ Erro ao criar grupo: ${description}`);
    console.error(error.response?.data || error.message);
    return null;
  }
}

async function adicionarVeiculosAoGrupo(groupId, vehicleIds) {
  try {
    console.log(`📌 Adicionando ${vehicleIds.length} veículos ao grupo ${groupId}`);
    const url = `${API_URL}/VehicleGroups(${groupId})/_.addVehicles`;
    await axios.post(url, { vehicleIds }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    console.log(`✅ Veículos adicionados com sucesso ao grupo ${groupId}`);
  } catch (error) {
    console.error(`❌ Erro ao adicionar veículos ao grupo ${groupId}`);
    console.error(error.response?.data || error.message);
  }
}

async function processar() {
  console.log("🚀 Iniciando processamento da planilha...");
  const gruposMap = {};

  for (const carro of carros) {
    const vin = carro.vin;
    const grupoNome = carro.grupo;

    console.log(`\n===========================`);
    console.log(`🚗 VIN: ${vin} | Grupo: ${grupoNome}`);
    console.log(`===========================`);

    const vehicleId = await buscarVeiculoPorVIN(vin);
    if (!vehicleId) continue;

    if (!gruposMap[grupoNome]) gruposMap[grupoNome] = [];
    gruposMap[grupoNome].push(vehicleId);
  }

  console.log("\n📊 Resumo de grupos encontrados:");
  console.log(gruposMap);

  for (const grupoNome of Object.keys(gruposMap)) {
    const securityGroup = gruposSeguranca.find((g) => g.nome === grupoNome);
    if (!securityGroup) {
      console.warn(`⚠️ Grupo de segurança não encontrado para: ${grupoNome}`);
      continue;
    }

    let grupoId = await buscarGrupoPorDescricao(grupoNome);
    if (!grupoId) grupoId = await criarGrupo(grupoNome, securityGroup.id);
    if (!grupoId) continue;

    await adicionarVeiculosAoGrupo(grupoId, gruposMap[grupoNome]);
  }

  console.log("\n✅ Processamento concluído!");
}

processar();
