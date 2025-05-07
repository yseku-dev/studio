'use server';
/**
 * @fileOverview Explica un fragmento de código en lenguaje sencillo usando la API de Groq.
 *
 * - explainCodeSnippet - Una función que explica un fragmento de código.
 * - ExplainCodeSnippetInput - El tipo de entrada para la función explainCodeSnippet.
 * - ExplainCodeSnippetOutput - El tipo de retorno para la función explainCodeSnippet.
 */

import {z} from 'zod'; // Zod sigue siendo útil para la validación de esquemas

const ExplainCodeSnippetInputSchema = z.object({
  code: z.string().describe('El fragmento de código a explicar.'),
  groqApiKey: z.string().describe('La clave API para acceder al modelo Groq.'), // Añadido para la llamada a Groq
  groqModelName: z.string().describe('El nombre del modelo Groq a utilizar.'), // Añadido
});
export type ExplainCodeSnippetInput = z.infer<typeof ExplainCodeSnippetInputSchema>;

const ExplainCodeSnippetOutputSchema = z.object({
  explanation: z.string().describe('La explicación del fragmento de código en lenguaje sencillo.'),
});
export type ExplainCodeSnippetOutput = z.infer<typeof ExplainCodeSnippetOutputSchema>;

// Esta ya no es una función de flujo de Genkit.
export async function explainCodeSnippet(input: ExplainCodeSnippetInput): Promise<ExplainCodeSnippetOutput> {
  const validationResult = ExplainCodeSnippetInputSchema.safeParse(input);
  if (!validationResult.success) {
    console.error("Entrada inválida para explainCodeSnippet:", validationResult.error.format());
    throw new Error("Entrada inválida para la explicación de código.");
  }

  const { code, groqApiKey, groqModelName } = input;

  // Simulación de llamada a la API de Groq para explicación
  // En una implementación real, aquí se haría una llamada HTTP POST a la API de Groq.
  console.log(`Simulando explicación de Groq para el código con el modelo ${groqModelName}:`, code.substring(0, 100) + "...");
  
  // Placeholder para el endpoint real y el cuerpo de la solicitud
  const groqAPIEndpoint = "https://api.groq.com/openai/v1/chat/completions";
  const requestBody = {
    model: groqModelName,
    messages: [
      {
        role: "system",
        content: `Eres un desarrollador de software experto. Explica el siguiente fragmento de código en lenguaje sencillo, para que una persona no técnica pueda entenderlo. Responde ÚNICAMENTE con la explicación en formato JSON con una clave "explanation".`
      },
      {
        role: "user",
        content: `Fragmento de código:\n${code}`
      }
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  };

  try {
    // Bloque comentado para llamada real a la API. Descomentar y ajustar según sea necesario.
    /*
    const response = await fetch(groqAPIEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Respuesta de error de la API de Groq (explicación):", errorBody);
      throw new Error(`Error de la API de Groq (explicación): ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let parsedResult: ExplainCodeSnippetOutput;
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        try {
            parsedResult = JSON.parse(data.choices[0].message.content);
             if (!parsedResult.explanation) {
                throw new Error("La respuesta JSON de Groq no contiene el campo 'explanation'.");
            }
        } catch (parseError) {
            console.error("Error al parsear la respuesta JSON de Groq (explicación):", parseError);
            throw new Error("La respuesta de Groq (explicación) no es un JSON válido o falta el campo 'explanation'.");
        }
    } else {
        throw new Error("Respuesta inesperada de la API de Groq (explicación).");
    }
    return parsedResult;
    */

    await new Promise(resolve => setTimeout(resolve, 1200)); // Simular retraso de red
    console.warn("Usando respuesta simulada para explainCodeSnippet. Reemplazar con llamada real a la API de Groq.");
    
    let simulatedExplanation = `Este fragmento de código (analizado simuladamente por ${groqModelName}) define una función que parece realizar ${code.length % 2 === 0 ? 'un cálculo matemático' : 'una operación con texto'}. Toma ${Math.max(1, code.split('\n').length % 3)} parámetros de entrada y devuelve un resultado después de procesarlos.`;
    if (code.toLowerCase().includes('async')) {
        simulatedExplanation += " Es una operación asíncrona, lo que significa que puede ejecutarse en segundo plano sin bloquear otras tareas."
    }


    const mockOutput: ExplainCodeSnippetOutput = {
      explanation: simulatedExplanation,
    };
    
    const outputValidation = ExplainCodeSnippetOutputSchema.safeParse(mockOutput);
    if (!outputValidation.success) {
        console.error("Salida simulada inválida para explainCodeSnippet:", outputValidation.error.format());
        // Fallback o error
    }
    return mockOutput;

  } catch (error) {
    console.error("Error llamando a la API de Groq para explicación (o en simulación):", error);
    throw error;
  }
}
