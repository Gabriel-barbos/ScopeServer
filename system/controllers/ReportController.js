import {
  buildDateFilter,
  addClientFilter,
  servicesByType,
  schedulesByStatus,
  pendingByClient,
  pendingByProvider,
  evolutionByMonth,
  evolutionByDay,
  servicesByClient,
  reportDaily,
} from "../services/reportAggregations.js";

import { generateExcelExport } from "../services/reportExport.js";

class ReportController {
  // GET /api/reports
  getReportData = async (req, res) => {
    try {
      const { startDate, endDate, clientId } = req.query;
      const dateFilter = buildDateFilter(req.query);
      const matchWithClient = addClientFilter({ ...dateFilter }, clientId);

      const [
        svcByType,
        schByStatus,
        pendClient,
        pendProvider,
        evoMonth,
        evoDay,
        svcByClient,
        daily,
      ] = await Promise.all([
        servicesByType(matchWithClient),
        schedulesByStatus(matchWithClient),
        pendingByClient(dateFilter, clientId),
        pendingByProvider(dateFilter, clientId),
        evolutionByMonth(),
        evolutionByDay(),
        servicesByClient(),
        reportDaily(startDate, endDate),
      ]);

      res.json({
        servicesByType: svcByType,
        schedulesByStatus: schByStatus,
        pendingByClient: pendClient,
        pendingByProvider: pendProvider,
        evolutionByMonth: evoMonth,
        evolutionByDay: evoDay,
        servicesByClient: svcByClient,
        reportDaily: daily,
      });
    } catch (error) {
      console.error("Erro no getReportData:", error);
      res.status(500).json({ error: error.message });
    }
  };

  // POST /api/reports/export
  exportData = async (req, res) => {
    try {
      const { type, includeOldData, dateFrom, dateTo } = req.body;

      // Validação
      if (!["schedules", "services"].includes(type)) {
        return res
          .status(400)
          .json({ error: "Tipo inválido. Use 'schedules' ou 'services'" });
      }

      if (type === "schedules" && includeOldData) {
        return res
          .status(400)
          .json({ error: "includeOldData não é suportado para agendamentos" });
      }

      // Gera o Excel
      const workbook = await generateExcelExport({
        type,
        includeOldData: includeOldData || false,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });

      // Monta nome do arquivo
      const timestamp = new Date().toISOString().slice(0, 10);
      const suffix = includeOldData ? "-com-legado" : "";
      const filename = `${type}-report${suffix}-${timestamp}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${filename}`
      );

      await workbook.xlsx.write(res);
    } catch (error) {
      console.error("Erro no exportData:", error);
      res.status(500).json({ error: error.message });
    }
  };
}

export default new ReportController();