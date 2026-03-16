import 'dotenv/config';
import { generateSupportResponse } from './system/services/geminiService.js'; // Importante: inclua o .js no final

async function runTest() {
    console.log("🚀 Iniciando teste em modo ES Modules...\n");

    const mockMongoContext = "O Equipamento X reseta segurando o botão traseiro por 10s.";
    const mockReactHistory = [];
    const currentMessage = "Como reseto o Equipamento X?";

    try {
        const response = await generateSupportResponse(
            mockMongoContext,
            mockReactHistory,
            currentMessage
        );

        console.log("=== RESPOSTA DA IA ===");
        console.log(response);
        console.log("======================");

    } catch (error) {
        console.error("❌ Teste falhou:", error.message);
    }
}

runTest();