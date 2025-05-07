'use server';

import { analyzeCodeAlchemistSource, AnalyzeCodeAlchemistSourceInput, AnalyzeCodeAlchemistSourceOutput, SuggestionUnit } from '@/ai/flows/analyze-codealchemist-source-flow';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob'; 

interface AutoUpdateAnalysisResult {
  success: boolean;
  data?: AnalyzeCodeAlchemistSourceOutput;
  error?: string;
  chunksProcessed?: number;
  totalChunks?: number;
}

// Estimación: 1 token ~ 3 caracteres. Límite de 6000 tokens para el contenido.
// Dejamos un margen para el prompt y la respuesta JSON.
const MAX_CHARS_PER_CHUNK = 5500 * 3; // Aproximadamente 16500 caracteres

export async function handleAutoAnalyzeAppSource(
  apiKey: string,
  modelName: string,
  analysisPreferences?: string,
  onProgress?: (progress: { processed: number; total: number }) => void
): Promise<AutoUpdateAnalysisResult> {
  if (!apiKey || !modelName) {
    return { success: false, error: "La clave API y el nombre del modelo son obligatorios. Por favor, configúralos en ajustes." };
  }

  const sourceBundleResult = await getApplicationSourceBundle(false); // Obtenemos archivos individuales
  if (!sourceBundleResult.success || !sourceBundleResult.files || sourceBundleResult.files.length === 0) {
    return { success: false, error: sourceBundleResult.error || "No se pudo obtener el código fuente para analizar." };
  }

  const files = sourceBundleResult.files;
  const chunks: string[] = [];
  let currentChunk = "";
  let currentChunkChars = 0;

  for (const file of files) {
    const fileContentMarker = `\n\n// --- Archivo: ${file.fileName} ---\n\n`;
    const fileEffectiveContent = file.content; // Usar el contenido completo del archivo.
                                          // La limitación de tokens se aplica a nivel de CHUNK.

    if (fileEffectiveContent.length + fileContentMarker.length > MAX_CHARS_PER_CHUNK) {
      // Si el archivo solo ya excede el tamaño del chunk, se procesa en trozos (o se trunca si es demasiado grande para manejarlo en trozos)
      // Para simplificar, si un archivo es muy grande, lo enviamos como su propio chunk
      // y confiamos en que la API de Groq lo maneje o lo truncaremos aquí si es necesario.
      // Omitimos la división de archivos individuales por ahora para mantener la lógica manejable.
      // La AI podría no ser capaz de proveer `suggestedFullFileContent` para archivos muy grandes.
      if (currentChunkChars > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
        currentChunkChars = 0;
      }
      // Truncar archivos individuales si son masivos, para evitar errores de API no manejados
      let processedFileContent = fileEffectiveContent;
      if (fileEffectiveContent.length > MAX_CHARS_PER_CHUNK * 2) { // Un umbral arbitrario para truncar archivos muy grandes
        console.warn(`Archivo ${file.fileName} truncado debido a su tamaño excesivo (${fileEffectiveContent.length} caracteres). Solo se procesarán los primeros ${MAX_CHARS_PER_CHUNK * 2} caracteres.`);
        processedFileContent = fileEffectiveContent.substring(0, MAX_CHARS_PER_CHUNK * 2);
      }
      chunks.push(fileContentMarker + processedFileContent);

    } else if (currentChunkChars + fileEffectiveContent.length + fileContentMarker.length > MAX_CHARS_PER_CHUNK) {
      chunks.push(currentChunk);
      currentChunk = fileContentMarker + fileEffectiveContent;
      currentChunkChars = fileEffectiveContent.length + fileContentMarker.length;
    } else {
      currentChunk += fileContentMarker + fileEffectiveContent;
      currentChunkChars += fileEffectiveContent.length + fileContentMarker.length;
    }
  }

  if (currentChunkChars > 0) {
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    return { success: false, error: "No se generaron fragmentos de código para analizar." };
  }
  
  console.log(`Código fuente dividido en ${chunks.length} fragmentos para análisis.`);

  const allResults: AnalyzeCodeAlchemistSourceOutput[] = [];
  let processedChunks = 0;

  for (const chunk of chunks) {
    const input: AnalyzeCodeAlchemistSourceInput = {
      sourceCode: chunk, 
      groqApiKey: apiKey,
      groqModelName: modelName,
      analysisPreferences,
    };

    try {
      console.log(`Analizando fragmento ${processedChunks + 1} de ${chunks.length}... (${chunk.length} caracteres)`);
      const result = await analyzeCodeAlchemistSource(input);
      allResults.push(result);
      processedChunks++;
      if (onProgress) { // Notificar progreso (esto es del lado del servidor, no se puede llamar directamente desde el cliente)
        // Esta llamada a onProgress no funcionará como se espera si handleAutoAnalyzeAppSource se llama desde un componente de servidor
        // y onProgress es una función del cliente. Se necesitaría un mecanismo de streaming o sondeo para el progreso real en la UI.
        // Por ahora, esto es más un log interno.
         console.log(`Progreso: ${processedChunks}/${chunks.length}`);
      }
    } catch (error) {
      console.error(`Error analizando el fragmento ${processedChunks + 1}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido durante el análisis de un fragmento.";
      // Decidir si continuar con otros fragmentos o fallar todo el proceso
      // Por ahora, fallamos si un fragmento falla para simplificar.
      return { success: false, error: `Falló el análisis del fragmento ${processedChunks + 1}: ${errorMessage}`, chunksProcessed: processedChunks, totalChunks: chunks.length };
    }
  }

  // Agregar resultados
  if (allResults.length === 0) {
    return { success: false, error: "No se obtuvieron resultados del análisis de los fragmentos." };
  }

  const aggregatedResult: AnalyzeCodeAlchemistSourceOutput = {
    analysisTitle: allResults[0].analysisTitle || `Análisis Agregado de ${chunks.length} Fragmentos`,
    identifiedAreas: Array.from(new Set(allResults.flatMap(r => r.identifiedAreas))),
    suggestions: allResults.flatMap(r => r.suggestions.map(s => ({...s, area: s.area || "General (Fragmento)" }))), // Asegurar que 'area' tenga un valor
    overallAssessment: allResults.map(r => r.overallAssessment).join('\n\n---\n\n'),
  };
  
  return { success: true, data: aggregatedResult, chunksProcessed: processedChunks, totalChunks: chunks.length };
}


export interface AppSourceFile {
  fileName: string;
  content: string;
}
interface AppSourceBundleResult {
  success: boolean;
  files?: AppSourceFile[];
  concatenatedSource?: string; 
  error?: string;
}

const ignorePatterns = [
  'node_modules/**',
  '.next/**',
  '*.lock',
  '*.zip', // Ignorar archivos zip
  '.DS_Store',
  '*.log',
  'build/**',
  'dist/**',
  '.env', // Ignorar .env general
  '.env.local', 
  '.env.development',
  '.env.production',
  '.env.test',
  // Añade más patrones si es necesario
];

export async function getApplicationSourceBundle(concatenate: boolean = false): Promise<AppSourceBundleResult> {
  try {
    const projectRoot = process.cwd();
    const allFiles = await glob('**/*', { 
      cwd: projectRoot, 
      nodir: true, 
      dot: true, 
      ignore: ignorePatterns,
      follow: false, 
    });

    const filesData: AppSourceFile[] = [];
    let concatenatedContent = "";

    for (const relativeFilePath of allFiles) {
      try {
        const stats = await fs.stat(path.join(projectRoot, relativeFilePath));
        
        // Para la concatenación (usada por la IA si no se divide en chunks manualmente)
        if (concatenate && stats.size > 500 * 1024) { 
            console.warn(`Archivo omitido de la concatenación por tamaño: ${relativeFilePath} (${(stats.size / 1024).toFixed(2)} KB)`);
            const message = `// Archivo ${relativeFilePath} omitido de la concatenación por ser demasiado grande (${(stats.size / 1024).toFixed(2)} KB).\n`;
            concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${message}`;
            filesData.push({ fileName: relativeFilePath, content: message });
            continue;
        }


        const fullPath = path.join(projectRoot, relativeFilePath);
        // Intentar leer como texto, si falla, podría ser binario
        let content: string;
        try {
          content = await fs.readFile(fullPath, 'utf-8');
        } catch (readError) {
          // Si falla la lectura como utf-8, es probable que sea binario o no legible
          // Lo marcamos como tal en lugar de fallar toda la operación.
          // Esto es importante para la descarga ZIP, que podría incluir binarios.
          // Para el análisis de IA, estos archivos deberían ser ignorados o manejados de forma diferente.
          const error = readError as NodeJS.ErrnoException;
          console.warn(`No se pudo leer el archivo ${relativeFilePath} como texto (podría ser binario): ${error.message}`);
          content = `// Error: No se pudo leer el archivo ${relativeFilePath} como texto. Puede ser un archivo binario o corrupto.`;
           // Para la descarga, es mejor no incluir contenido erróneo si es binario.
           // Para el análisis, este mensaje está bien.
           // Si 'concatenate' es false (para descarga ZIP), no queremos este mensaje de error como contenido.
           if (!concatenate && (error.code === 'EILSEQ' || stats.size > 1024 * 1024) /* heurística para binarios grandes */) {
             filesData.push({ fileName: relativeFilePath, content: "// Archivo binario o no legible, contenido omitido para ZIP." });
             continue; // No añadir al concatenado si no se puede leer
           }
        }
        
        filesData.push({ fileName: relativeFilePath, content });
        if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
        }
      } catch (fileProcessingError) {
        const error = fileProcessingError as NodeJS.ErrnoException;
        // Ignorar errores de acceso o si es un directorio que se coló
        if (error.code !== 'EACCES' && error.code !== 'EISDIR') {
            console.warn(`No se pudo procesar el archivo ${relativeFilePath} para el paquete fuente:`, error);
        }
        const errorMessage = `// Error: No se pudo procesar el archivo. (${error.message})`;
        filesData.push({ fileName: relativeFilePath, content: errorMessage });
         if (concatenate) {
          concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${errorMessage}`;
        }
      }
    }

    if (filesData.length === 0) {
        return { success: false, error: "No se pudieron leer archivos fuente para el paquete." };
    }

    return { success: true, files: filesData, concatenatedSource: concatenate ? concatenatedContent : undefined };
  } catch (error) {
    console.error("Error empaquetando el código fuente de la aplicación:", error);
    const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
    return { success: false, error: `Falló la obtención del paquete de código fuente: ${errorMessage}` };
  }
}


export async function applySuggestedChange(filePath: string, originalContent: string, suggestedContent: string): Promise<{success: boolean, error?: string, newContent?: string}> {
    console.log(`SIMULACIÓN: Intentando aplicar cambio a: ${filePath}`);
    
    const isSimulation = true; 

    try {
        const fullPath = path.join(process.cwd(), filePath);
        
        console.log(`SIMULACIÓN: Ruta completa del archivo: ${fullPath}`);
        console.log("--- CONTENIDO ORIGINAL (PRIMEROS 500 CARACTERES) ---");
        console.log(originalContent.substring(0, 500) + (originalContent.length > 500 ? "..." : ""));
        console.log("--- CONTENIDO SUGERIDO (PRIMEROS 500 CARACTERES) ---");
        console.log(suggestedContent.substring(0, 500) + (suggestedContent.length > 500 ? "..." : ""));

        if (isSimulation) {
            console.log(`SIMULACIÓN: El archivo ${filePath} se habría actualizado con el contenido sugerido si la escritura estuviera habilitada.`);
            console.log("SIMULACIÓN: No se han realizado cambios reales en el sistema de archivos.");
            return { success: true, newContent: suggestedContent };
        } else {
            // ESTE BLOQUE NO SE EJECUTARÁ
            try {
                await fs.access(fullPath); 
            } catch (accessError) {
                 console.error(`SIMULACIÓN: Error de acceso al archivo ${filePath} antes de la escritura:`, accessError);
                 return { success: false, error: `El archivo ${filePath} no es accesible.` };
            }
            // await fs.writeFile(fullPath, suggestedContent, 'utf-8'); // DESACTIVADO
            // console.log(`REAL: El archivo ${filePath} ha sido actualizado con el contenido sugerido.`);
            // return { success: true, newContent: suggestedContent };
            return { success: false, error: "La escritura real de archivos está deshabilitada en esta función."};
        }

    } catch (error) {
        console.error(`SIMULACIÓN: Error al intentar aplicar el cambio al archivo ${filePath}:`, error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al aplicar el cambio.";
        return { success: false, error: errorMessage };
    }
}

    