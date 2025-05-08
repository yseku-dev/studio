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
    // testGroqConnection already returns a serializable structure
    return result; 
  } catch (error) {
    // This catch block might be redundant if testGroqConnection itself handles all its errors and returns a TestConnectionResult.
    // However, it's here as a safeguard for unexpected errors thrown by testGroqConnection that aren't caught internally.
    console.error("Error en handleTestGroqConnection (capa de acción):", error); // Log the raw error

    let errorMessage: string;
    if (error instanceof Error) {
        errorMessage = error.message;
    } else {
        try {
            errorMessage = String(error);
        } catch (e) {
            errorMessage = "Ocurrió un error desconocido durante la prueba de conexión.";
        }
    }
    if (!errorMessage && errorMessage !== '') {
        errorMessage = "Ocurrió un error desconocido durante la prueba de conexión.";
    } else if (errorMessage === '') {
        errorMessage = "Error sin mensaje detallado.";
    }
    return { success: false, message: `Falló la prueba de conexión (capa de acción): ${errorMessage}` };
  }
}
