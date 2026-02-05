import axios from "axios";
import XLSX from "xlsx";

const API_URL = "https://live.mzoneweb.net/mzone62.api"; 
const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NTc1MzAxMjMsImV4cCI6MTc1NzUzMzcyMywiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiZmZiZTA4MzQtNjVjNy00ODFlLTk0YTEtYTFmYTNiOGJlYjkxIiwiYXV0aF90aW1lIjoxNzU3NTMwMTIzLCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiZm9jb2FkbXNjb3BlIiwibXpfdXNlcmdyb3VwX2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiwibXpfc2hhcmRfY29kZSI6IkJSQVpJTCIsInNjb3BlIjpbIm16X3VzZXJuYW1lIiwib3BlbmlkIiwiZGktYXBpLmFsbCIsIm16Ni1hcGkuYWxsIl0sImFtciI6WyJwd2QiXX0.mMB0xSZjR13w_sNZaicMEYbaQIg8UtscHsvMPaTIcA64midETFr_lJSBoYXCDbJVcpPeN0v1APVn8shwz7yhmItZIXRKGSj6hbaGgFYPY5ugMsB64APuaJyuSUDIoVOyrigdrnG0USo_tSsgGsydZuO15Z1uHdKu6c0KF3NoK_dG0-MGHXBou1gnvoGyYx5tZUde2TdUJyVWR-0XQfue8YWVDuYrSIo6tDoNSExqfCJMCq2e7xnPSaXG2zb-CMRnQ5TBc4D9lIDpOp_NSQc62gM6lxFcZtcLwmqZCiIJVYY_S2XYx4NPJmIZmflr-Pugm_6qE3q2nKPQxtA5uxZnko7DUuHwUM7rwpNZ2SKGCg6KpdrfjZROjiHw4aKAKNJKlNAfbv08g93xs9Q8JLCwoltthNi4n0i_r813MaRUZ9eg_d7qMEMhb38nKtcDN98K4KWa0S9F-je4T9TAbkOq2hRgs5GSf6DbBEYzqTqP-lR9k4_GE00-_6VleshKp-UX2Pl9uJgSsWbXIcGZi2a46AiM39ieVjhUSjwx2CSpLG8KVudkb5UMR9QkozciYNynVsfCCVEKquXzIRUfAQT-sJhWgo3w4OJ5HfElMuxd296lP3foA8ZBeEgvEl5Cij5pgIv9ODXIVJDS1HcRekibczJKjFVNFc-461kZ63gv6hI";

// Cliente axios 
const api = axios.create({
  baseURL: API_URL,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
});

async function deleteDriversFromExcel(filePath) {
  // 1. Ler a planilha
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  const total = data.length;
  let deletados = 0;

  for (let i = 0; i < total; i++) {
    const row = data[i];
    const description = row.description?.trim();
    if (!description) continue;

    try {
      // 2. Buscar motorista pelo description
      const res = await api.get(
        `/Vehicles?$filter=description eq '${description}'`
      );
      const driver = res.data.value?.[0];

      if (!driver) {
        console.log(`❌ [${i + 1}/${total}] Não encontrado: ${description}`);
        continue;
      }

      const driverId = driver.id;

      await api.delete(`/Vehicles(${driverId})`);

      deletados++;
      console.log(
        `✅ [${i + 1}/${total}] Motorista "${description}" (id=${driverId}) deletado com sucesso`
      );
    } catch (err) {
      console.error(`⚠️ [${i + 1}/${total}] Erro para ${description}:`);
      console.error("➡️ Método:", err.config?.method?.toUpperCase());
      console.error("➡️ URL:", err.config?.url);
      console.error("➡️ Status:", err.response?.status);
      console.error("➡️ Resposta:", err.response?.data || err.message);
    }
  }

  console.log(`\n👉 Finalizado. ${deletados}/${total} motoristas deletados.`);
}

// Executar
deleteDriversFromExcel("./motoristas.xlsx");
