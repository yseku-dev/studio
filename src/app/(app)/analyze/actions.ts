'use server';

import { suggestCodeImprovements, SuggestCodeImprovementsInput, SuggestCodeImprovementsOutput } from '@/ai/flows/suggest-code-improvements';

interface AnalyzeCodeResult {
  success: boolean;
  data?: SuggestCodeImprovementsOutput;
  error?: string;
}

export async function handleAnalyzeCode(
  code: string,
  apiKey: string,
  modelName: string
): Promise<AnalyzeCodeResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "API key and model name are required. Please configure them in settings." };
  }

  const input: SuggestCodeImprovementsInput = {
    code,
    groqApiKey: apiKey,
    groqModelName: modelName,
  };

  try {
    // The AI flow is expected to call the actual Groq service.
    // The provided `analyzeCodeWithGroq` in `src/services/groq.ts` is a placeholder.
    // We trust the AI flow `suggestCodeImprovements` to handle the actual call.
    const result = await suggestCodeImprovements(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error analyzing code:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during analysis.";
    return { success: false, error: `Failed to analyze code: ${errorMessage}` };
  }
}
