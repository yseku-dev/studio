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
  const log = (message: string, level: 'INFO' | 'DETAIL' | 'WARN' | 'ERROR' = 'INFO') => {
    const timestampedMessage = `[GitService ${level} ${new Date().toISOString()}] ${message}`;
    internalLogs.push(timestampedMessage);
    if (level === 'ERROR' || level === 'WARN') console.warn(timestampedMessage);
    else console.log(timestampedMessage);
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

    const basePathForGlob = tempRepoPath; // specificPath ? path.join(tempRepoPath, specificPath) : tempRepoPath;
    // Note: specificPath handling with glob might need adjustment if it's a file or if paths need to be relative to original repo root.
    // For now, glob operates from the root of the cloned repo.

    const filesInRepo = await glob('**/*', {
      cwd: basePathForGlob,
      nodir: true,
      dot: true,
      ignore: ignorePatterns,
      follow: false,
    });

    log(`Glob encontró ${filesInRepo.length} archivos en el repositorio clonado después de aplicar filtros.`, 'INFO');
    filesInRepo.forEach(f => log(`Archivo encontrado por glob en repo: ${f}`, 'DETAIL'));


    if (filesInRepo.length === 0) {
      log('No se encontraron archivos en el repositorio clonado después del filtrado.', 'WARN');
      // Consider if this should be an error or an empty success
    }

    const filesData: AppSourceFile[] = [];
    let concatenatedContent = "";

    for (const relativeFilePath of filesInRepo) {
      const fullPath = path.join(basePathForGlob, relativeFilePath);
      try {
        const stats = await fs.stat(fullPath);
        if (stats.size > 1 * 1024 * 1024) { // Skip files larger than 1MB from concatenation for safety
          log(`Archivo omitido de la concatenación por tamaño > 1MB: ${relativeFilePath}`, 'WARN');
          filesData.push({ fileName: relativeFilePath, content: `// Contenido omitido: Archivo demasiado grande (${(stats.size / (1024*1024)).toFixed(2)}MB)` });
          continue;
        }
        const content = await fs.readFile(fullPath, 'utf-8');
        filesData.push({ fileName: relativeFilePath, content });
        concatenatedContent += `\n\n// --- Archivo: ${relativeFilePath} ---\n\n${content}`;
      } catch (readError) {
        log(`No se pudo leer el archivo ${relativeFilePath} del repositorio clonado: ${(readError as Error).message}`, 'WARN');
        filesData.push({ fileName: relativeFilePath, content: `// Error al leer archivo: ${(readError as Error).message}` });
      }
    }
    
    log(`Procesamiento de archivos del repositorio finalizado. Total de archivos procesados: ${filesData.length}.`, 'INFO');

    return {
      success: true,
      files: filesData,
      concatenatedSource: concatenatedContent,
      logsBuilt: internalLogs,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido durante la obtención del repositorio Git.";
    log(`Error crítico obteniendo contenido del repositorio Git: ${errorMessage}`, 'ERROR');
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
        log(`Error al limpiar el directorio temporal ${tempRepoPath}: ${(cleanupError as Error).message}`, 'ERROR');
      }
    }
  }
}
