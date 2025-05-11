
import {
  DEFAULT_LLM_PROVIDER,
  LLM_PROVIDERS,
  type LLMProviderId,
  getLocalStorageApiKeyName,
  getLocalStorageModelName,
  LOCALSTORAGE_PROVIDER_ID_KEY
} from '@/config/llm-config';
import type { AgentConfig, AgentLLMConfig, WorkgroupConfig } from '@/types/agent';
import type { LLMOptions } from '@/services/groq';
import { ORCHESTRATOR_AGENT_NAME } from '@/config/agent-config';

/**
 * Resolves the final LLM configuration options based on the selected source.
 * Reads from localStorage for global settings or agent/workgroup-specific settings.
 *
 * @param sourceId 'global', 'agent:<agentId>', or 'workgroup:<workgroupId>'.
 * @param agents List of available agents.
 * @param workgroups List of available workgroups.
 * @returns The resolved LLMOptions object, or null if configuration is incomplete or invalid.
 */
export function resolveLlmOptionsForSource(
  sourceId: string,
  agents: AgentConfig[],
  workgroups: WorkgroupConfig[] = [] // Optional, only needed if sourceId is a workgroup
): LLMOptions | null {
  let providerId: LLMProviderId | null = null;
  let modelName: string | null = null;
  let apiKey: string | null = null;
  let apiUrl: string | undefined;
  let providerConfig = null;
  let agentForConfig: AgentConfig | undefined = undefined;

  if (sourceId === 'global') {
    providerId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
    providerConfig = LLM_PROVIDERS.find(p => p.id === providerId);
    if (providerConfig) {
        modelName = localStorage.getItem(getLocalStorageModelName(providerConfig.id));
        apiKey = localStorage.getItem(getLocalStorageApiKeyName(providerConfig.id));
        apiUrl = localStorage.getItem(`codealchemist_apiurl_${providerConfig.id}`) || providerConfig.apiUrl;
    }
  } else if (sourceId.startsWith('agent:')) {
    const agentId = sourceId.split(':')[1];
    agentForConfig = agents.find(a => a.id === agentId);
  } else if (sourceId.startsWith('workgroup:')) {
    const workgroupId = sourceId.split(':')[1];
    const workgroup = workgroups.find(wg => wg.id === workgroupId);
    if (workgroup) {
      // For a workgroup, use the orchestrator's configuration
      agentForConfig = agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
      if (!agentForConfig) {
        console.error(`resolveLlmOptions: Orchestrator agent not found in workgroup: ${workgroup.name}`);
        return null;
      }
    } else {
      console.error(`resolveLlmOptions: Workgroup not found for ID: ${workgroupId}`);
      return null;
    }
  }

  if (agentForConfig) {
    if (agentForConfig.llmConfig === 'default') {
      // Resolve global config if agent uses default
      providerId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
      providerConfig = LLM_PROVIDERS.find(p => p.id === providerId);
       if (providerConfig) {
        modelName = localStorage.getItem(getLocalStorageModelName(providerConfig.id));
        apiKey = localStorage.getItem(getLocalStorageApiKeyName(providerConfig.id));
        apiUrl = localStorage.getItem(`codealchemist_apiurl_${providerConfig.id}`) || providerConfig.apiUrl;
      }
    } else {
      // Use agent's specific config
      providerId = agentForConfig.llmConfig.providerId;
      providerConfig = LLM_PROVIDERS.find(p => p.id === providerId);
      if (providerConfig) {
        modelName = agentForConfig.llmConfig.modelName;
        apiKey = agentForConfig.llmConfig.apiKey || localStorage.getItem(getLocalStorageApiKeyName(providerConfig.id));
        apiUrl = agentForConfig.llmConfig.apiUrl || localStorage.getItem(`codealchemist_apiurl_${providerConfig.id}`) || providerConfig.apiUrl;
      }
    }
  }


  // Validation
  if (!providerId || !providerConfig) {
    console.error(`resolveLlmOptions: Provider not found or not resolved for source: ${sourceId}`);
    return null;
  }
  if (!modelName) {
    console.error(`resolveLlmOptions: Model name not found for provider: ${providerConfig.name} (Source: ${sourceId})`);
    return null;
  }
  if (providerConfig.requiresApiKey && !apiKey) {
     console.error(`resolveLlmOptions: API key required but not found for provider: ${providerConfig.name} (Source: ${sourceId})`);
    return null;
  }

  return {
    providerId: providerConfig.id, // Ensure this is the final resolved providerId
    modelName,
    apiKey: apiKey || '',
    apiUrl,
  };
}
