// src/types/agent.ts
import type { LLMProviderId } from '@/config/llm-config';

/**
 * Configuración LLM específica para un agente.
 * Si es 'default', el agente usará la configuración global de la aplicación.
 * Para configuración 'custom', solo se especifica el proveedor y el modelo.
 * La clave API y la URL se heredan de la configuración global.
 */
export type AgentSpecificLLMConfig = {
  providerId: LLMProviderId;
  modelName: string;
};

export type AgentLLMConfig = 'default' | AgentSpecificLLMConfig;

export interface AgentCapabilities {
  selfCodeAccess?: boolean;
  executionCapability?: boolean;
  virtualEnvCapability?: boolean;
  readWriteCapability?: boolean;
}


export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemMessage: string;
  llmConfig: AgentLLMConfig;
  capabilities?: AgentCapabilities;
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
