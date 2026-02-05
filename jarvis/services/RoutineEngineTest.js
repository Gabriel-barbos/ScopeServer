import ExcelReader from './ExcelReader.js';
import getRoutineModel from "../models/Routine.js";
const Routine = await getRoutineModel();

class RoutineEngineTest {
  static async execute({ filePath }) {
    const columnsConfig = {
      chassi: 'Chassi',
      cliente: 'Cliente',
      grupo: 'Concessionária/Grupo de veiculos',
    };

    const excelRows = ExcelReader.read(filePath, columnsConfig);

    if (!excelRows.length) {
      return {
        summary: { totalExcelRows: 0 },
        routines: [],
        errors: [{ reason: 'Nenhuma linha válida encontrada na planilha' }],
      };
    }

    const routines = await Routine.find().populate('client');
    const routineMap = new Map();

    routines.forEach((routine) => {
      const key = routine.clientIdentificator?.trim().toLowerCase();
      if (!key) return;

      if (!routineMap.has(key)) routineMap.set(key, []);
      routineMap.get(key).push(routine);
    });

    const routinesToProcess = new Map();
    const errorReport = [];

    excelRows.forEach((row) => {
      let matched = false;

      if (!row.chassi || !row.cliente) {
        errorReport.push({
          line: row.line,
          chassi: row.chassi,
          cliente: row.cliente,
          reason: 'Linha incompleta (chassi ou cliente ausente)',
        });
        return;
      }

      const possibleRoutines = routineMap.get(row.cliente);

      if (!possibleRoutines) {
        errorReport.push({
          line: row.line,
          chassi: row.chassi,
          cliente: row.cliente,
          reason: 'Cliente não possui rotina cadastrada',
        });
        return;
      }

      possibleRoutines.forEach((routine) => {
        const routineGroup = routine.groupIdentificator?.trim().toLowerCase() || null;
        const excelGroup = row.grupo?.trim().toLowerCase() || null;

        // Se rotina exige grupo específico, deve bater
        if (routineGroup && routineGroup !== excelGroup) {
          return;
        }

        matched = true;

        if (!routinesToProcess.has(routine._id.toString())) {
          routinesToProcess.set(routine._id.toString(), {
            routine,
            vehicles: [],
          });
        }

        routinesToProcess.get(routine._id.toString()).vehicles.push(row.chassi);
      });

      if (!matched) {
        errorReport.push({
          line: row.line,
          chassi: row.chassi,
          cliente: row.cliente,
          grupo: row.grupo,
          reason: 'Cliente possui rotina, mas grupo não corresponde',
        });
      }
    });

    const executionResults = [];

    for (const { routine, vehicles } of routinesToProcess.values()) {
      const routineReport = {
        routineId: routine._id,
        routineName: routine.name,
        client: routine.client.name,
        executedActions: {},
        mode: 'TEST',
      };

      if (routine.addVehicleToGroup) {
        routineReport.executedActions.addVehicleToGroup = {
          simulated: true,
          vehicleGroupId: routine.vehicleGroup,
          vehicles,
          totalVehicles: vehicles.length,
        };
      }

      if (routine.shareVehicle) {
        routineReport.executedActions.shareVehicle = {
          simulated: true,
          shareGroupId: routine.shareGroup,
          vehicles,
          totalVehicles: vehicles.length,
        };
      }

      executionResults.push(routineReport);
    }

    return {
      summary: {
        totalExcelRows: excelRows.length,
        matchedRoutines: executionResults.length,
        errorCount: errorReport.length,
        mode: 'TEST',
      },
      routines: executionResults,
      errors: errorReport,
    };
  }
}

export default RoutineEngineTest;