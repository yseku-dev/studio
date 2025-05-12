// src/types/project.ts
export interface AppSourceFile {
  fileName: string; // Relative path from project root
  content: string;
}

export interface AppSourceBundleResult {
  success: boolean;
  files?: AppSourceFile[];
  concatenatedSource?: string; // Used when files are combined into one string for analysis
  error?: string;
  logsBuilt?: string[]; // Logs from the bundling process
}
