import xlsx from 'xlsx';
class ExcelReader {
  static read(filePath, columnsConfig) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rows = xlsx.utils.sheet_to_json(worksheet, {
      defval: '',
    });

    return rows
      .map((row, index) => {
        const chassi = row[columnsConfig.chassi];
        const cliente = row[columnsConfig.cliente];
        const grupo = row[columnsConfig.grupo];

        if (!chassi || !cliente) return null;

        return {
          chassi: String(chassi).trim(),
          cliente: String(cliente).trim().toLowerCase(),
          grupo: grupo ? String(grupo).trim().toLowerCase() : null,
          line: index + 2, 
        };
      })
      .filter(Boolean);
  }
}

export default ExcelReader;
