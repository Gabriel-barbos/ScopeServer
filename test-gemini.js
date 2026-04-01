import dotenv from "dotenv";
dotenv.config();

async function listarModelos() {
  // Testa ambas as chaves
  const keys = [
    { name: "Principal", key: process.env.GEMINI_API_KEY },
    { name: "Secundária", key: process.env.GEMINI_API_KEY_SECONDARY },
  ].filter(k => k.key);

  for (const { name, key } of keys) {
    console.log(`\n===== Chave ${name} =====`);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );

      // Se não for 200, mostra o erro cru
      if (!response.ok) {
        const err = await response.text();
        console.log(`❌ Status ${response.status}: ${err}`);
        continue;
      }

      const data = await response.json();

      // Debug: mostra o que veio caso não tenha models
      if (!data.models) {
        console.log("❌ Resposta sem campo 'models':", JSON.stringify(data, null, 2));
        continue;
      }

      // Filtra só os que suportam generateContent (chat/texto)
      const modelosTexto = data.models.filter(m =>
        m.supportedGenerationMethods?.includes("generateContent")
      );

      console.log(`✅ ${modelosTexto.length} modelos disponíveis para texto:\n`);
      modelosTexto.forEach(m => {
        const id = m.name.replace("models/", "");
        console.log(`  - ${id}`);
        console.log(`    Display: ${m.displayName}`);
        console.log(`    Methods: ${m.supportedGenerationMethods.join(", ")}`);
        console.log("");
      });

    } catch (error) {
      console.log(`❌ Erro de rede: ${error.message}`);
    }
  }
}

listarModelos();