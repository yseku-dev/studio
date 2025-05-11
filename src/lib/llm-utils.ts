
import {
  DEFAULT_LLM_PROVIDER,
  LLM_PROVIDERS,
  MODELS_BY_PROVIDER,
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
      if (tokensA !== tokensB) return tpmB - tokensA; // Corrected to tokensB - tokensA for descending
      return a.localeCompare(b);
    });
    return modelKeys.length > 0 ? modelKeys[0] : null;
}

export interface LocalStorageSnapshot {
  [LOCALSTORAGE_PROVIDER_ID_KEY]: LLMProviderId | null;
  apiKeys: Partial<Record<LLMProviderId, string | null>>;
  modelNames: Partial<Record<LLMProviderId, string | null>>;
  apiUrls: Partial<Record<LLMProviderId, string | null>>;
}


/**
 * Resolves the final LLM configuration options based on the selected source.
 * Reads from localStorage for global settings or agent/workgroup-specific settings.
 *
 * @param sourceId 'global', 'agent:<agentId>', or 'workgroup:<workgroupId>'.
 * @param agents List of available agents.
 * @param workgroups List of available workgroups.
 * @param localStorageSnapshot Optional snapshot of localStorage items for server-side usage.
 * @returns The resolved LLMOptions object, or null if configuration is incomplete or invalid.
 */
export function resolveLlmOptionsForSource(
  sourceId: string,
  agents: AgentConfig[],
  workgroups: WorkgroupConfig[] = [],
  localStorageSnapshot?: LocalStorageSnapshot
): LLMOptions | null {
  let finalProviderId: LLMProviderId | null = null;
  let finalModelName: string | null = null;
  let finalApiKey: string | null = null;
  let finalApiUrl: string | undefined;
  let finalProviderConfig: typeof LLM_PROVIDERS[number] | undefined;

  let agentForConfigSource: AgentConfig | undefined = undefined;

  const getLocalStorageItem = (key: string): string | null => {
    if (localStorageSnapshot) {
      // This part needs refinement based on how snapshot is structured for generic keys
      // For now, this specific key is handled directly below.
      if (key === LOCALSTORAGE_PROVIDER_ID_KEY) return localStorageSnapshot[LOCALSTORAGE_PROVIDER_ID_KEY];
      return null; // Or throw error if key not expected via snapshot specific fields
    }
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  };

  const getProviderSpecificItem = (
    providerId: LLMProviderId, 
    type: 'apiKey' | 'modelName' | 'apiUrl'
  ): string | null => {
    if (localStorageSnapshot) {
      switch (type) {
        case 'apiKey': return localStorageSnapshot.apiKeys[providerId] ?? null;
        case 'modelName': return localStorageSnapshot.modelNames[providerId] ?? null;
        case 'apiUrl': return localStorageSnapshot.apiUrls[providerId] ?? null;
      }
    }
    if (typeof window !== 'undefined') {
      switch (type) {
        case 'apiKey': return localStorage.getItem(getLocalStorageApiKeyName(providerId));
        case 'modelName': return localStorage.getItem(getLocalStorageModelName(providerId));
        case 'apiUrl': return localStorage.getItem(`codealchemist_apiurl_${providerId}`);
      }
    }
    return null;
  };


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

  if (agentForConfigSource && agentForConfigSource.llmConfig !== 'default') {
    finalProviderId = agentForConfigSource.llmConfig.providerId;
    finalProviderConfig = LLM_PROVIDERS.find(p => p.id === finalProviderId);
    if (finalProviderConfig) {
      finalModelName = agentForConfigSource.llmConfig.modelName;
      finalApiKey = agentForConfigSource.llmConfig.apiKey || getProviderSpecificItem(finalProviderConfig.id, 'apiKey');
      finalApiUrl = agentForConfigSource.llmConfig.apiUrl || getProviderSpecificItem(finalProviderConfig.id, 'apiUrl') || finalProviderConfig.apiUrl;
    }
  } else {
    finalProviderId = (localStorageSnapshot ? localStorageSnapshot[LOCALSTORAGE_PROVIDER_ID_KEY] : getLocalStorageItem(LOCALSTORAGE_PROVIDER_ID_KEY) as LLMProviderId | null) || DEFAULT_LLM_PROVIDER;
    finalProviderConfig = LLM_PROVIDERS.find(p => p.id === finalProviderId);
    if (finalProviderConfig) {
      finalModelName = getProviderSpecificItem(finalProviderConfig.id, 'modelName');
      if (!finalModelName) {
        finalModelName = getDefaultModelForProvider(finalProviderConfig.id);
      }
      finalApiKey = getProviderSpecificItem(finalProviderConfig.id, 'apiKey');
      finalApiUrl = getProviderSpecificItem(finalProviderConfig.id, 'apiUrl') || finalProviderConfig.apiUrl;
    }
  }

  if (!finalProviderId || !finalProviderConfig) {
    console.error(`resolveLlmOptions: Provider not found or not resolved for source: ${sourceId}`);
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
