export interface CodeSnapshot {
  id: string; // Identificador único de la versión guardada
  name: string; // Nombre descriptivo de la versión
  code: string; // El código fuente guardado
  timestamp: string; // Marca de tiempo ISO de cuándo se guardó la versión
  analysis?: { // Resultados del análisis de IA, si existen
    suggestion: string; // Código sugerido por la IA
    explanation: string; // Explicación de la sugerencia
  };
}
