import dotenv from "dotenv";
dotenv.config();

async function listarModelos() {
  const apiKey = process.env.GEMINI_API_KEY;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  
  const data = await response.json();
  
  // Filtra apenas os modelos que suportam geração de texto (generateContent)
  const modelosDisponiveis = data.models.filter(m => 
    m.supportedGenerationMethods.includes("generateContent")
  );

  console.log("Modelos suportados na sua chave:");
  modelosDisponiveis.forEach(m => console.log(`- ${m.name.replace('models/', '')}`));
}

listarModelos();