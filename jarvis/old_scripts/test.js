import xlsx from "xlsx";
const { readFile, utils } = xlsx;

// READ EXCEL FILE
function lerPlanilha(caminho) {
  const workbook = readFile(caminho); 
  const sheet = workbook.Sheets[workbook.SheetNames[0]]; 
  return utils.sheet_to_json(sheet); 
}

// SEPARATE NAME
function separarNomeCompleto(nomeCompleto) {
  const partes = nomeCompleto.trim().split(" ");
  const firstName = partes.shift();
  const surname = partes.join(" ") || " ";
  return { firstName, surname };
}

// BUILD DRIVER OBJECT
function montarMotorista(row, index) {
  const { firstName, surname } = separarNomeCompleto(row["Nome completo"]);

  return {
    description: row["Nome completo"],
    driverKeyCode: row["Código mzone"] || 1000 + index,
    firstName,
    surname,
    costPerHour: 0,
    startDate: new Date().toISOString()
  };
}

// RUN
(() => {
  const dadosPlanilha = lerPlanilha("Drivers.xlsx");

  console.log(`Total lido: ${dadosPlanilha.length} motoristas`);

  const motoristas = dadosPlanilha.map((row, index) =>
    montarMotorista(row, index)
  );

  // 2 exemplos
  console.log("\nExemplo de requisições que seriam disparadas:");
  console.log(JSON.stringify(motoristas[0], null, 2));
  console.log(JSON.stringify(motoristas[1], null, 2));
})();