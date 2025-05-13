
// src/services/git-service.ts
'use server';

import simpleGit, { type SimpleGit, type SimpleGitOptions } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { glob } from 'glob';
import type { AppSourceFile, AppSourceBundleResult } from '@/types/project';

// Default ignore patterns, similar to those in autoupdate/actions.ts
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  '.next/**',
  '*.zip',
  // '*.json', // Keep package.json, tsconfig.json etc.
  '.DS_Store',
  '*.log',
  'build/**',
  'dist/**',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.git/**', // Ensure .git directory itself is ignored
  'public/generated/**',
  // '*.lock', // Keep lock files
];

/**
 * Fetches the contents of a Git repository.
 * @param repoUrl The URL of the Git repository.
 * @param specificPath Optional specific path within the repository to fetch (e.g., a subdirectory or a single file).
 * @param ignorePatterns Optional array of glob patterns to ignore.
 * @returns A promise that resolves to an AppSourceBundleResult.
 */
export async function fetchRepositoryContents(
  repoUrl: string,
  specificPath?: string, // Not yet fully implemented for single file/subdir focus in glob
  ignorePatterns: string[] = DEFAULT_IGNORE_PATTERNS
): Promise<AppSourceBundleResult> {
  const internalLogs: string[] = [];
  const log = (message: string, level: 'INFO' | 'DETAIL' | 'WARN' | 'ERROR' = 'INFO', data?: any) => {
    const timestamp = new Date().toISOString();
     let dataStringForLogMessage = '';
    if (data !== undefined) {
        try {
            let dataPreviewString = '';
            if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean' || data === null) {
                dataPreviewString = String(data);
            } else if (data instanceof Error) {
                dataPreviewString = `Error: ${data.message}${data.stack ? `\nStack: ${data.stack}` : ''}`;
            } else {
                dataPreviewString = JSON.stringify(data);
            }
            dataStringForLogMessage = ` | Data: ${dataPreviewString.substring(0, 300)}${dataPreviewString.length > 300 ? '...' : ''}`;
        } catch (e) {
            dataStringForLogMessage = ' | Data: [Contenido no serializable para vista previa del log]';
            console.warn(`[GITSERVICE_LOG_SERIALIZATION_ERROR][${timestamp}] Failed to stringify data for log type ${level}, message: ${message}`, e);
        }
    }
    const timestampedMessage = `[GitService ${level} ${timestamp}] ${message}${dataStringForLogMessage}`;
    internalLogs.push(timestampedMessage);
    if (level === 'ERROR' || level === 'WARN') console.warn(timestampedMessage);
    else if (level === 'INFO' || level === 'DETAIL') console.log(timestampedMessage.replace(/\n/g, ' ')); // Keep original logging for info/detail
  };

  let tempRepoPath: string | undefined;
  log(`Iniciando obtención de contenido desde Git URL: ${repoUrl}`, 'INFO');

  try {
    tempRepoPath = await fs.mkdtemp(path.join(os.tmpdir(), 'codealchemist-gitfetch-'));
    log(`Directorio temporal creado para clonar: ${tempRepoPath}`, 'DETAIL');

    const git: SimpleGit = simpleGit({ baseDir: tempRepoPath, binary: 'git', maxConcurrentProcesses: 1 });
    
    log(`Clonando repositorio desde ${repoUrl} en ${tempRepoPath}...`, 'INFO');
    await git.clone(repoUrl, tempRepoPath, ['--depth=1', '--no-tags', '--shallow-submodules']); // Shallow clone for speed
    log('Repositorio clonado exitosamente.', 'INFO');

    const basePathForGlob = tempRepoPath; 

    const filesInRepo = await glob('**/*', {
      cwd: basePathForGlob,
      nodir: true,
      dot: true,
      ignore: ignorePatterns,
      follow: false,
    });

    log(`Glob encontró ${filesInRepo.length} archivos en el repositorio clonado después de aplicar filtros.`, 'INFO');
    if (filesInRepo.length < 20) { // Log individual files only if there aren't too many
        filesInRepo.forEach(f => log(`Archivo encontrado por glob en repo: ${f}`, 'DETAIL'));
    } else {
        log(`Se encontraron ${filesInRepo.length} archivos. Omitiendo listado individual por brevedad.`, 'DETAIL');
    }


    if (filesInRepo.length === 0) {
      log('No se encontraron archivos en el repositorio clonado después del filtrado.', 'WARN');
    }

    const filesData: AppSourceFile[] = [];
    let concatenatedContent = "";
    let totalConcatenatedChars = 0;

    for (const relativeFilePath of filesInRepo) {
      const fullPath = path.join(basePathForGlob, relativeFilePath);
      try {
        log(`Procesando archivo del repo: ${relativeFilePath}`, 'DETAIL');
        const stats = await fs.stat(fullPath);
        log(`Estadísticas para ${relativeFilePath}: tamaño ${stats.size} bytes.`, 'DETAIL');
        
        if (stats.size > 1 * 1024 * 1024) { 
          log(`Archivo omitido de la concatenación por tamaño > 1MB: ${relativeFilePath}`, 'WARN');
          filesData.push({ fileName: relativeFilePath, content: `// Contenido omitido: Archivo demasiado grande (${(stats.size / (1024*1024)).toFixed(2)}MB)` });
          continue;
        }
        const content = await fs.readFile(fullPath, 'utf-8');
        filesData.push({ fileName: relativeFilePath, content });
        const fileMarker = `\n\n// --- Archivo: ${relativeFilePath} ---\n\n`;
        concatenatedContent += fileMarker + content;
        totalConcatenatedChars += fileMarker.length + content.length;
        log(`Archivo ${relativeFilePath} añadido. Longitud total concatenada aprox: ${totalConcatenatedChars}`, 'DETAIL');
      } catch (readError) {
        log(`No se pudo leer el archivo ${relativeFilePath} del repositorio clonado: ${(readError as Error).message}`, 'WARN', readError);
        filesData.push({ fileName: relativeFilePath, content: `// Error al leer archivo: ${(readError as Error).message}` });
      }
    }
    
    log(`Procesamiento de archivos del repositorio finalizado. Total de archivos procesados: ${filesData.length}. Longitud total concatenada: ${totalConcatenatedChars}`, 'INFO');

    return {
      success: true,
      files: filesData,
      concatenatedSource: concatenatedContent,
      logsBuilt: internalLogs,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido durante la obtención del repositorio Git.";
    log(`Error crítico obteniendo contenido del repositorio Git: ${errorMessage}`, 'ERROR', error);
    if (error instanceof Error && error.stack) {
        log(`Stack del error crítico: ${error.stack}`, 'ERROR');
    }
    return {
      success: false,
      error: `Falló la obtención de contenido del repositorio Git: ${errorMessage}`,
      logsBuilt: internalLogs,
    };
  } finally {
    if (tempRepoPath) {
      log(`Limpiando directorio temporal: ${tempRepoPath}`, 'INFO');
      try {
        await fs.rm(tempRepoPath, { recursive: true, force: true });
        log('Directorio temporal eliminado.', 'INFO');
      } catch (cleanupError) {
        log(`Error al limpiar el directorio temporal ${tempRepoPath}: ${(cleanupError as Error).message}`, 'ERROR', cleanupError);
      }
    }
  }
}

