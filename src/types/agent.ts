// src/types/agent.ts
import type { LLMProviderId } from '@/config/llm-config';

/**
 * Configuración LLM específica para un agente.
 * Si es 'default', el agente usará la configuración global de la aplicación.
 */
export type AgentSpecificLLMConfig = {
  providerId: LLMProviderId;
  modelName: string;
  apiKey?: string | null; // Solo si el proveedor lo requiere y se quiere sobrescribir
  apiUrl?: string | null;  // Solo si el proveedor lo soporta y se quiere sobrescribir
};

export type AgentLLMConfig = 'default' | AgentSpecificLLMConfig;

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemMessage: string;
  llmConfig: AgentLLMConfig;
  // --- New Capability Flags ---
  /** Permite al agente leer el código fuente de la aplicación o su propio código. */
  selfCodeAccess?: boolean;
  /** Permite al agente ejecutar código (requiere un entorno seguro). */
  executionCapability?: boolean;
  /** Permite al agente gestionar o usar entornos virtuales (ej. Python venv). */
  virtualEnvCapability?: boolean;
  /** Permite al agente leer y escribir archivos en el sistema (requiere permisos y entorno seguro). */
  readWriteCapability?: boolean;
  // ----------------------------
  // Futuros campos: tools, function_map, human_input_mode, max_consecutive_auto_reply, etc.
}

export interface WorkgroupConfig {
  id: string;
  name: string;
  description: string;
  /**
   * Array de IDs de agentes que pertenecen a este grupo de trabajo.
   * Incluye obligatoriamente el ID del agente 'OrquestadorFlujoAgentes' (u 'Orquestador del Grupo'),
   * que es central para la gestión del flujo de trabajo.
   */
  agentIds: string[];
  /**
   * La tarea general o el objetivo principal asignado a este grupo de trabajo.
   * El Orquestador del Grupo utiliza esta tarea como punto de partida para dirigir las interacciones.
   */
  task: string;
  // Futuros campos: admin_agent_id, mode (e.g., 'round_robin', 'auto'), max_rounds
}


