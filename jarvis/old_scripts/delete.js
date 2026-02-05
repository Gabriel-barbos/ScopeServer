import axios from "axios";
import XLSX from "xlsx";

const API_URL = "https://live.mzoneweb.net/mzone62.api"; 
const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NjgzOTUzMzgsImV4cCI6MTc2ODM5ODkzOCwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiNGZkNGFkYjEtOGE2MC00NThjLWIzNTMtNTZkM2U3MDI5OWZhIiwiYXV0aF90aW1lIjoxNzY4Mzk1MzM4LCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiZXFtYXJhbmhhbyIsIm16X3VzZXJncm91cF9pZCI6IjVmODM4YjU2LWUyZmQtNGEwMC04YzdmLTAwMWY3OTk4NzA4ZCIsIm16X3NoYXJkX2NvZGUiOiJCUkFaSUwiLCJzY29wZSI6WyJtel91c2VybmFtZSIsIm9wZW5pZCIsImRpLWFwaS5hbGwiLCJtejYtYXBpLmFsbCJdLCJhbXIiOlsicHdkIl19.AqYcXoXPo5mlLAFvZSQWEwqn11tsQcwlA7ga7kntWpBPoGR3aj-lDFTpP5ns8LjSDca-lH-yUKhDuIr1kZbGV88RkWIRGawG87OwH-a0McyreeHfavpC17jbHK22TQxPxEOfPYlH9LsWO-OLdikV51stNYZ-HyplU9mBGp4J4Sm-4uyuLMLHFJuntzzzYmZkkqc84OTyI5pSGVf7W1bSOfu1ArWbSUKOW_hI-pkWXhbXE1ilF4nWhj14HQkOnnAXxxK30eSt2bTroyd6HD6khPx9BUlsNnMig0vd2jVkNUnDdooCdUQtac6U54gGKhsXuqLC1wejJbBge21rxISK5X5n0z6YV74KLfTb_GsMUGFCoV-0DcU_LXtywl5FMmSfeop1wZzHsIXZvrfJNFy82pc7qSs6EPHqNgxyazYtNleUy8ox2MdRPiHt0pn84XkRYvrVKcnpu8jWvnf0xoZTtMZTd5zmwEMe92E42DFLwXyc0BVOox46lNmlRh8ONG8RO_Kpv6oBOtOQBHvoNK34vzedHbLGq_mbwyjCS2OXbvj1PPyWM2jFDL6LEA-wQEHHejjZuzYsrek-UzMyRUx0kaOofeDN73W2dDBqBsqqUnceoiVv-44jvCM9Eu2deXDAji_3FXqTT32d5Y1PZy9pmvIQyucFPn0ZD2XEJ5piWtA"
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
        `/Drivers?$filter=description eq '${description}'`
      );
      const driver = res.data.value?.[0];

      if (!driver) {
        console.log(`❌ [${i + 1}/${total}] Não encontrado: ${description}`);
        continue;
      }

      const driverId = driver.id;

      // 3. Excluir motorista
      await api.delete(`/Drivers(${driverId})`);

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
