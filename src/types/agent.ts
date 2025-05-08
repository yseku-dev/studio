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
  // Futuros campos: tools, function_map, human_input_mode, max_consecutive_auto_reply, etc.
}

export interface WorkgroupConfig {
  id: string;
  name: string;
  description: string;
  agentIds: string[]; // Array de IDs de agentes
  task: string; // La tarea general para el grupo de trabajo
  // Futuros campos: admin_agent_id, mode (e.g., 'round_robin', 'auto'), max_rounds
}

