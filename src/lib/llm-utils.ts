
import {
  DEFAULT_LLM_PROVIDER,
  LLM_PROVIDERS,
  type LLMProviderId,
  getLocalStorageApiKeyName,
  getLocalStorageModelName,
  LOCALSTORAGE_PROVIDER_ID_KEY
} from '@/config/llm-config';
import type { AgentConfig, AgentLLMConfig } from '@/types/agent';
import type { LLMOptions } from '@/services/groq';

/**
 * Resolves the final LLM configuration options based on the selected source.
 * Reads from localStorage for global settings or agent-specific settings.
 *
 * @param sourceId 'global' or the ID of the agent.
 * @param agents List of available agents (only needed if sourceId is an agent ID).
 * @returns The resolved LLMOptions object, or null if configuration is incomplete or invalid.
 */
export function resolveLlmOptionsForSource(
  sourceId: string,
  agents: AgentConfig[]
): LLMOptions | null {
  let providerId: LLMProviderId | null = null;
  let modelName: string | null = null;
  let apiKey: string | null = null;
  let apiUrl: string | undefined;
  let providerConfig = null;

  if (sourceId === 'global') {
    providerId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
    providerConfig = LLM_PROVIDERS.find(p => p.id === providerId);
    modelName = localStorage.getItem(getLocalStorageModelName(providerId));
    apiKey = localStorage.getItem(getLocalStorageApiKeyName(providerId));
    apiUrl = localStorage.getItem(`codealchemist_apiurl_${providerId}`) || providerConfig?.apiUrl;
  } else {
    const agent = agents.find(a => a.id === sourceId);
    if (!agent) return null; // Agent not found

    if (agent.llmConfig === 'default') {
      // Resolve global config if agent uses default
      providerId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
      providerConfig = LLM_PROVIDERS.find(p => p.id === providerId);
      modelName = localStorage.getItem(getLocalStorageModelName(providerId));
      apiKey = localStorage.getItem(getLocalStorageApiKeyName(providerId));
      apiUrl = localStorage.getItem(`codealchemist_apiurl_${providerId}`) || providerConfig?.apiUrl;
    } else {
      // Use agent's specific config
      providerId = agent.llmConfig.providerId;
      providerConfig = LLM_PROVIDERS.find(p => p.id === providerId);
      modelName = agent.llmConfig.modelName;
      // Use agent's key/URL if set, fallback to global for that provider, then provider default
      apiKey = agent.llmConfig.apiKey || localStorage.getItem(getLocalStorageApiKeyName(providerId));
      apiUrl = agent.llmConfig.apiUrl || localStorage.getItem(`codealchemist_apiurl_${providerId}`) || providerConfig?.apiUrl;
    }
  }

  // Validation
  if (!providerId || !providerConfig) {
    console.error(`resolveLlmOptions: Provider not found for ID: ${providerId}`);
    return null;
  }
  if (!modelName) {
    console.error(`resolveLlmOptions: Model name not found for provider: ${providerId}`);
    return null;
  }
  if (providerConfig.requiresApiKey && !apiKey) {
     console.error(`resolveLlmOptions: API key required but not found for provider: ${providerId}`);
    return null;
  }

  return {
    providerId,
    modelName,
    apiKey: apiKey || '', // Ensure apiKey is always a string, even if empty
    apiUrl,
    // timeoutMs could be added here if needed globally or per source
  };
}
