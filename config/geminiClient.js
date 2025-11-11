import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

let genAI = null;
let model = null;

// Inicializar el cliente de Google Gemini
export function getGeminiClient() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured in .env file');
    }

    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Google Gemini AI client initialized');
  }

  return genAI;
}

// Obtener el modelo configurado (gemini-2.5-flash)
export function getGeminiModel() {
  if (!model) {
    const client = getGeminiClient();
    model = client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });
    console.log('✅ Gemini model (gemini-2.5-flash) loaded');
  }

  return model;
}

// Función para generar análisis de IA
export async function generateAIAnalysis(prompt) {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log('🔍 AI Analysis:', text);
    return text;
  } catch (error) {
    console.error('❌ Error generating AI analysis:', error.message);
    throw new Error(`Failed to generate AI analysis: ${error.message}`);
  }
}

export default { getGeminiClient, getGeminiModel, generateAIAnalysis };
