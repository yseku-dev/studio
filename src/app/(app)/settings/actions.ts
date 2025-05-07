'use server';

import { testGroqConnection, GroqOptions } from '@/services/groq';

interface TestConnectionResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function handleTestGroqConnection(
  apiKey: string,
  modelName: string
): Promise<TestConnectionResult> {
  if (!apiKey || !modelName) {
    return { success: false, message: "La Clave API de Groq y el Nombre del Modelo son obligatorios." };
  }

  const options: GroqOptions = {
    apiKey,
    modelName,
  };

  try {
    const result = await testGroqConnection(options);
    return result;
  } catch (error) {
    console.error("Error en handleTestGroqConnection:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido durante la prueba de conexión.";
    return { success: false, message: `Falló la prueba de conexión: ${errorMessage}` };
  }
}
