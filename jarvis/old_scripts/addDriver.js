
import axios from "axios";
import fs from "fs";
import xlsx from "xlsx"; 
const { readFile, utils } = xlsx; 

const API_URL = "https://live.mzoneweb.net/mzone62.api/Drivers"; 
const TOKEN = "preciso gerar o token";

function lerPlanilha(caminho) {
  const workbook = readFile(caminho); 
  const sheet = workbook.Sheets[workbook.SheetNames[0]]; 
  return utils.sheet_to_json(sheet); 
}

// SEPARAR PRIMEIRO NOME E SOBRENOME
function separarNomeCompleto(nomeCompleto) {
  const partes = nomeCompleto.trim().split(" ");
  const firstName = partes.shift();
  const surname = partes.join(" ") || " ";
  return { firstName, surname };
}

// MONTAR OBJETO MOTORISTA
function montarMotorista(row, index) {
  const { firstName, surname } = separarNomeCompleto(row["Nome completo"]);

  return {
    description: row["Nome completo"],
    driverKeyCode: row["Código mzone"] || 1000 + index,
    identityNumber: row["Id driver"]?.toString() || "", 
    firstName,
    surname,
    costPerHour: 0,
    startDate: new Date().toISOString()
  };
}

// CADASTRAR MOTORISTAS
async function cadastrarMotoristas(lista) {
  for (let i = 0; i < lista.length; i++) {
    try {
      const res = await axios.post(API_URL, lista[i], {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      console.log(`✅ [${i + 1}/${lista.length}] Criado -> ID: ${res.data.id}`);
    } catch (err) {
      console.error(`❌ Erro linha ${i + 1}:`, err.response?.data || err.message);
      fs.appendFileSync(
        "erros.log",
        `Linha ${i + 1}: ${JSON.stringify(err.response?.data || err.message)}\n`
      );
    }
  }
}

// EXECUÇÃO
(async () => {
  try {
    const dadosPlanilha = lerPlanilha("Drivers.xlsx"); 
    console.log(`📑 Lidos ${dadosPlanilha.length} motoristas da planilha`);

    const motoristas = dadosPlanilha.map((row, index) =>
      montarMotorista(row, index)
    );

    await cadastrarMotoristas(motoristas);
    console.log("🏁 Importação finalizada!");
  } catch (error) {
    console.error("Erro geral:", error.message);
  }
})();
