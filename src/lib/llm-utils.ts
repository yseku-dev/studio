
import {
  DEFAULT_LLM_PROVIDER,
  LLM_PROVIDERS,
  MODELS_BY_PROVIDER, // Added import
  type LLMProviderId,
  getLocalStorageApiKeyName,
  getLocalStorageModelName,
  LOCALSTORAGE_PROVIDER_ID_KEY
} from '@/config/llm-config';
import type { AgentConfig, WorkgroupConfig } from '@/types/agent';
import type { LLMOptions } from '@/services/groq';
import { ORCHESTRATOR_AGENT_NAME } from '@/config/agent-config';

/**
 * Helper function to get the default model for a given provider,
 * sorted by TPM, then context window size, then alphabetically.
 */
function getDefaultModelForProvider(providerId: LLMProviderId): string | null {
    const providerModels = MODELS_BY_PROVIDER[providerId] || {};
    // Sort by TPM desc, then context window desc, then name asc
    const modelKeys = Object.keys(providerModels).sort((a,b) => {
      const tpmA = providerModels[a].tpm || 0;
      const tpmB = providerModels[b].tpm || 0;
      if (tpmA !== tpmB) return tpmB - tpmA;
      const tokensA = providerModels[a].tokens || 0;
      const tokensB = providerModels[b].tokens || 0;
      if (tokensA !== tokensB) return tpmB - tokensA;
      return a.localeCompare(b);
    });
    return modelKeys.length > 0 ? modelKeys[0] : null;
}


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
  workgroups: WorkgroupConfig[] = []
): LLMOptions | null {
  let finalProviderId: LLMProviderId | null = null;
  let finalModelName: string | null = null;
  let finalApiKey: string | null = null;
  let finalApiUrl: string | undefined;
  let finalProviderConfig: typeof LLM_PROVIDERS[number] | undefined;

  let agentForConfigSource: AgentConfig | undefined = undefined;

  if (sourceId.startsWith('agent:')) {
    const agentId = sourceId.split(':')[1];
    agentForConfigSource = agents.find(a => a.id === agentId);
    if (!agentForConfigSource) {
      console.error(`resolveLlmOptions: Agent not found for ID: ${agentId}`);
      return null;
    }
  } else if (sourceId.startsWith('workgroup:')) {
    const workgroupId = sourceId.split(':')[1];
    const workgroup = workgroups.find(wg => wg.id === workgroupId);
    if (workgroup) {
      agentForConfigSource = agents.find(a => a.name === ORCHESTRATOR_AGENT_NAME && workgroup.agentIds.includes(a.id));
      if (!agentForConfigSource) {
        console.error(`resolveLlmOptions: Orchestrator agent for workgroup '${workgroup.name}' not found or not part of the workgroup.`);
        return null;
      }
    } else {
      console.error(`resolveLlmOptions: Workgroup not found for ID: ${workgroupId}`);
      return null;
    }
  }

  // Determine provider, model, API key, and API URL
  if (agentForConfigSource && agentForConfigSource.llmConfig !== 'default') {
    // Agent has a custom configuration
    finalProviderId = agentForConfigSource.llmConfig.providerId;
    finalProviderConfig = LLM_PROVIDERS.find(p => p.id === finalProviderId);
    if (finalProviderConfig) {
      finalModelName = agentForConfigSource.llmConfig.modelName; // This should be set if custom
      finalApiKey = agentForConfigSource.llmConfig.apiKey || localStorage.getItem(getLocalStorageApiKeyName(finalProviderConfig.id));
      finalApiUrl = agentForConfigSource.llmConfig.apiUrl || localStorage.getItem(`codealchemist_apiurl_${finalProviderConfig.id}`) || finalProviderConfig.apiUrl;
    }
  } else {
    // Source is 'global' or agent/workgroup orchestrator uses 'default' settings
    finalProviderId = localStorage.getItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null || DEFAULT_LLM_PROVIDER;
    finalProviderConfig = LLM_PROVIDERS.find(p => p.id === finalProviderId);
    if (finalProviderConfig) {
      finalModelName = localStorage.getItem(getLocalStorageModelName(finalProviderConfig.id));
      if (!finalModelName) { // Fallback if model not in localStorage
        finalModelName = getDefaultModelForProvider(finalProviderConfig.id);
      }
      finalApiKey = localStorage.getItem(getLocalStorageApiKeyName(finalProviderConfig.id));
      finalApiUrl = localStorage.getItem(`codealchemist_apiurl_${finalProviderConfig.id}`) || finalProviderConfig.apiUrl;
    }
  }

  // Validation
  if (!finalProviderId || !finalProviderConfig) {
    console.error(`resolveLlmOptions: Provider could not be determined or found for source: ${sourceId}`);
    return null;
  }
  if (!finalModelName) {
    console.error(`resolveLlmOptions: Model name not found for provider: ${finalProviderConfig.name} (Source: ${sourceId})`);
    return null;
  }
  if (finalProviderConfig.requiresApiKey && !finalApiKey) {
     console.error(`resolveLlmOptions: API key required but not found for provider: ${finalProviderConfig.name} (Source: ${sourceId})`);
    return null;
  }

  return {
    providerId: finalProviderConfig.id,
    modelName: finalModelName,
    apiKey: finalApiKey || '',
    apiUrl: finalApiUrl,
  };
}
