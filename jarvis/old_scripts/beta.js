import axios from 'axios';

const API_BASE = 'https://live.mzoneweb.net/mzone62.api';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NTY5MjQ5MTQsImV4cCI6MTc1NjkyODUxNCwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiZjAwYWVjNjEtMzE2Zi00MTU1LWExZWUtOWQzYzAzM2JiYWYyIiwiYXV0aF90aW1lIjoxNzU2OTI0OTE0LCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiVW5pZGFzYWRtIiwibXpfdXNlcmdyb3VwX2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiwibXpfc2hhcmRfY29kZSI6IkJSQVpJTCIsInNjb3BlIjpbIm16X3VzZXJuYW1lIiwib3BlbmlkIiwiZGktYXBpLmFsbCIsIm16Ni1hcGkuYWxsIl0sImFtciI6WyJwd2QiXX0.TFP2TyWbkKdn3dKpGGN3aHTss6QIeYUyBlU60ykZbxFhtNl7KIabaauoKK0mxWbS9TNtd8N_lQ1EAQLmPpP032zcpAV7uAhAL2U1tUtZiE4IXpHKLwVGmvKlm146LgeK540TfIcMvLRN3ksf0aGjZ3hw6Lhp2_nYjw0QT9Jub_bIYNX7aIsm5jza-I5vKGSiXrc1Ma0zlQ2NTdiLNvxSyHdo5-1t_zXWRw39yWNx683UVrDr9S4IkJGzPjZEzHmAOw45gNLeuwC6FQUCOg76UOPpl-PvupFs3ZuKDt1qAWcunFf3Jg343y0GvTWOEEAoVkE89GY4Wqx6vhwTVTWMwurAQHaTqwqNfVhLLFvYgbnIZ7cHNKwq_es4Q_07fr1UexvNeClz74SMaHjsrPUe4v8fpRIsX4unmh25PE-6I1FTo3nxNSDujdOYPnaWUi9PpXSJDLUAAdUNI-CXgNJrMusODvnY8FRL7HVjEPp64OFVop9mgKHHuCEX859HzhS6czGbswLkqqwakKoYb7Vwhdg3Ut_d6xHms_rK2nW0diIeIblRD0jsgDtSgs7lxHCymAKDZY9Gdh935x6ezKJ1EVDO9V_w1tJSNz6sq7xSpwES7eOfb5n9jWbxIoku7XyoUEWyzk1eZa-PIxeILb8pqU3NI-md6bnmAwRwWSZbPx8'; 

/**
 * Busca o ID do carro pelo VIN (chassi)
 */
// Busca o ID do carro pelo VIN
async function getVehicleIdByVin(vin) {
  console.log(`🔍 Buscando ID do veículo para VIN: ${vin}...`);
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

// Busca o ID do grupo pelo description
async function getVehicleGroupIdByDescription(description) {
  console.log(`🔍 Buscando ID do grupo de veículos com description: "${description}"...`);
  const url = `${API_BASE}/VehicleGroups?$filter=description eq '${description}'&$select=id,description`;

  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (response.data.value.length === 0) {
    console.log(`❌ Grupo de veículos com description "${description}" não encontrado.`);
    return null;
  }

  const groupId = response.data.value[0].id;
  console.log(`✅ ID do grupo encontrado: ${groupId}`);
  return groupId;
}

// Adiciona veículos ao grupo
async function addVehiclesToGroup(groupId, vehicleIds) {
  console.log(`⚡ Adicionando veículo(s) ao grupo ID: ${groupId}...`);
  const url = `${API_BASE}/VehicleGroups(${groupId})/_.addVehicles`;

  const body = {
    vehicleIds // Array de strings
  };

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
  const vin = '9BWAH5BZ6TT631916';
  const groupDescription = '00 - Todos os Veículos - Livre';

  const vehicleId = await getVehicleIdByVin(vin);
  if (!vehicleId) return;

  const groupId = await getVehicleGroupIdByDescription(groupDescription);
  if (!groupId) return;

  await addVehiclesToGroup(groupId, [vehicleId]);
}

main();