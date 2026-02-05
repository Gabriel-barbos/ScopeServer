import axios from "axios";
import fs from "fs";

const API_URL = "https://live.mzoneweb.net/mzone62.api"; 
const TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjlDNTg1RjFFODkzM0Q4RDJDMkJGRjdEQkIxQkRFMjBGRTFCNjVDNUEiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJuRmhmSG9rejJOTEN2X2Zic2IzaUQtRzJYRm8ifQ.eyJuYmYiOjE3NTgwNDk4MjgsImV4cCI6MTc1ODA1MzQyOCwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQiLCJhdWQiOlsiaHR0cHM6Ly9sb2dpbi5tem9uZXdlYi5uZXQvcmVzb3VyY2VzIiwiZGktYXBpIiwibXo2LWFwaSJdLCJjbGllbnRfaWQiOiJtei1lcW1hcmFuaGFvIiwic3ViIjoiNTJjMDk5NGEtZmNiNi00MTBlLWIyZWYtMjNlYjMyZTQ0OTY2IiwiYXV0aF90aW1lIjoxNzU4MDQ5ODI4LCJpZHAiOiJsb2NhbCIsIm16X3VzZXJuYW1lIjoiZXFwYXJhIiwibXpfdXNlcmdyb3VwX2lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiwibXpfc2hhcmRfY29kZSI6IkJSQVpJTCIsInNjb3BlIjpbIm16X3VzZXJuYW1lIiwib3BlbmlkIiwiZGktYXBpLmFsbCIsIm16Ni1hcGkuYWxsIl0sImFtciI6WyJwd2QiXX0.bI0FRLgi9Bt1xar4hqRGUCj24XBkjFN0d8RdOG3oZd8kRAgHRjTPxRg1w-amsYztwbCHcX7t7rnVy-7GzPWKsLkflg2r84RPE5olPVOVIH6qesYpAyyrlgeehccMtC-hiT1GgXW3Xjj7F9syTBZfK_imeTBGqc61h9WtqofdhOuK_8CUn0fbgVAi5wWN5LAm0GIooQBN2wIa4mU5N9WuGz5ABOYkWcSaU2Z18m6LhIFBTVLxdDgshjJy_Fg3WJRrOr3FX8_srIya1IoFTk4XDSdpJNEfx7W0EDuyrYb-CWuKfY4BvQrS0243c5ioid0IJklmCjtqCX9wc3JJKMR4Hu9L4bUm34LQg293vFD0Aii-dvBtKxmFIJZEIJII3O18yFAGYpNCQUQ5RUp5dVDxXfa-BdOuWn9gjuzAQ51oFW3Ct5Ba7a7ZJczxBHe96CLgtv4ue0lw_Ncu1p_H6Y60p8m9H59TZ9kjH4TZO0gouxl9jrjv2pSWxJPYUuIqceeiet2tpGqJBh2LYjTmq8Z9p8IAhWCKTUsFfzSdha6xHqVI6kWXXG1-AmoZtg8Em08WoqCRkZU9Oz3JcmeIr5VLR02SGYUFjkqqApseYq5qARdLtkYTNMH-skQ_UlVhWOD_zoQeDTqbHclVx5lpI1Vc2SVl1MWrB6ydpp5CLIdocNI"; 

const grupos = [
  "ALTAMIRA",
  "CASTANHAL",
  "TOME AÇU",
  "CAPANEMA",
  "PARAGOMINAS",
  "SALINÓPOLIS",
  "ABAETETUBA",
  "MÃE DO RIO",
  "TERRA ALTA",
  "SÃO MIGUEL DO GUAMÁ",
  "VIGIA",
  "CAPITAO POCO",
  "BRAGANÇA",
  "SANTA MARIA DO PARÁ",
  "CONCÓRDIA DO PARÁ",
  "BARCARENA",
  "MOCAJUBA",
  "CAMETÁ",
  "TAILÂNDIA",
  "BELEM",
  "BREVES",
  "SANTA ISABEL",
  "BELÉM",
  "SALVATERRA",
  "SANTARÉM",
  "ITAITUBA",
  "MONTE ALEGRE",
  "ÓBIDOS",
  "CAMPO VERDE",
  "NOVO PROGRESSO",
  "RUROPOLIS",
  "ALENQUER",
  "CASTELO DOS SONHOS",
  "JURUTI",
  "ORIXIMINÁ",
  "REDENCAO",
  "MARABA",
  "PARAUAPEBAS",
  "MARABÁ",
  "REDENÇÃO",
  "SÃO DOMINGOS DO ARAGUAIA",
  "NOVO REPARTIMENTO",
  "XINGUARA",
  "CONCEIÇÃO DO ARAGUAI",
  "SANTANA DO ARAGUAIA",
  "RONDON DO PARÁ",
  "TUCURUI",
  "SAO FELIX DO XINGU",
  "CANAA DOS CARAJAS",
  "ELDORADO DOS CARAJÁS",
  "JACUNDA",
  "TUCUMÃ",
  "TUCURUÍ"
];

async function criarGruposSeguranca() {
  const resultados = [];

  for (const nome of grupos) {
    try {
      const response = await axios.post(
        `${API_URL}/SecurityGroups`,
        { description: nome },
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      const id = response.data.id;
      console.log(`✅ Grupo criado: ${nome} | ID: ${id}`);

      resultados.push({ nome, id });

    } catch (error) {
      console.error(`❌ Erro ao criar grupo: ${nome}`);
      if (error.response) {
        console.error(error.response.status, error.response.data);
      } else {
        console.error(error.message);
      }
    }
  }

  fs.writeFileSync("gruposSeguranca.json", JSON.stringify(resultados, null, 2));
  console.log("📂 IDs salvos em gruposSeguranca.json");
}

criarGruposSeguranca();
