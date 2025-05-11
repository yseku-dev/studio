// src/config/llm-config.ts

export const DEFAULT_LLM_PROVIDER = "ollama"; // Changed from "groq"

export interface LLMProvider {
  id: LLMProviderId;
  name: string;
  apiUrl: string; // Base API URL, or full endpoint for OpenAI-compatible ones
  apiKeyName: string | null; // Name of the API key in environment or for user display
  requiresApiKey: boolean;
  isGroqCompatible?: boolean; // True if it uses OpenAI-like /chat/completions
  isAnthropicCompatible?: boolean;
  isOllamaCompatible?: boolean; // For /api/chat or /api/generate
}

export const LLM_PROVIDERS: readonly LLMProvider[] = [
  { id: "groq", name: "Groq", apiUrl: "https://api.groq.com/openai/v1", apiKeyName: "GROQ_API_KEY", requiresApiKey: true, isGroqCompatible: true },
  { id: "openai", name: "OpenAI", apiUrl: "https://api.openai.com/v1", apiKeyName: "OPENAI_API_KEY", requiresApiKey: true, isGroqCompatible: true },
  { id: "anthropic", name: "Anthropic", apiUrl: "https://api.anthropic.com/v1", apiKeyName: "ANTHROPIC_API_KEY", requiresApiKey: true, isAnthropicCompatible: true },
  { id: "lmstudio", name: "LM Studio", apiUrl: "http://localhost:1234/v1", apiKeyName: "LMSTUDIO_API_KEY", requiresApiKey: false, isGroqCompatible: true }, // Typically no key, but can be set in LM Studio
  { id: "ollama", name: "Ollama", apiUrl: "http://127.0.0.1:11434/v1", apiKeyName: "OLLAMA_API_KEY", requiresApiKey: false, isGroqCompatible: true, isOllamaCompatible: true }, // Supports OpenAI-like /v1/chat and native /api/chat
] as const;

export type LLMProviderId = typeof LLM_PROVIDERS[number]['id'];

// Model definitions with TPM (Tokens Per Minute) and Context Window Tokens
// TPM is mostly Groq-specific for now. Tokens = context window size.
export interface ModelInfo {
  tpm?: number;
  tokens?: number;
  notes?: string;
}

export const MODELS_BY_PROVIDER: Record<LLMProviderId, Record<string, ModelInfo>> = {
  groq: {
    // Highest TPM and large context
    "compound-beta": { tpm: 70000, tokens: 131072, notes: "Assumed large context similar to Llama 3.1 70B" }, // Assuming large context
    "compound-beta-mini": { tpm: 70000, tokens: 131072, notes: "Assumed large context similar to Llama 3.1 70B" }, // Assuming large context
    // High TPM, good context
    "meta-llama/llama-4-scout-17b-16e-instruct": { tpm: 30000, tokens: 16384, notes: "16k context" },
    // Mid TPM, very large context
    "llama-3.1-70b-versatile": { tpm: 12000, tokens: 131072, notes: "131k context" },
    // Mid TPM, good context
    "gemma2-9b-it": { tpm: 15000, tokens: 8192, notes: "8k context" }, // Updated with common Gemma context
    "llama-guard-3-8b": { tpm: 15000, tokens: 8192, notes: "8k context" }, // Updated with common Llama guard context
    // Lower TPM, very large context
    "llama-3.1-8b-instant": { tpm: 6000, tokens: 131072, notes: "131k context" },
    "meta-llama/llama-4-maverick-17b-128e-instruct": { tpm: 6000, tokens: 128000, notes: "128k context" },
    // Lower TPM, good context
    "llama3-70b-8192": { tpm: 6000, tokens: 8192 },
    "llama3-8b-8192": { tpm: 6000, tokens: 8192 },
    // Lower TPM, context not specified but likely large
    "deepseek-r1-distill-llama-70b": { tpm: 6000, tokens: 32768, notes: "Assumed large context like 32k" },
    "mistral-saba-24b": { tpm: 6000, tokens: 32768, notes: "Context window not specified, assume common large like 32k or more" },
    "qwen-qwq-32b": { tpm: 6000, tokens: 32768, notes: "Context window not specified, assume common large like 32k or more" },
    // Lower TPM, context not specified but likely standard
    "allam-2-7b": { tpm: 6000, tokens: 8192, notes: "Context window not specified, assume common like 8k" },
  },
  openai: {
    "gpt-4o": { tokens: 128000 },
    "gpt-4-turbo": { tokens: 128000 }, // Includes gpt-4-turbo-2024-04-09
    "gpt-4-32k": { tokens: 32768 },
    "gpt-3.5-turbo": { tokens: 16385, notes: "Supports 16k context, use gpt-3.5-turbo-0125 for latest" },
    "gpt-4": { tokens: 8192 },
  },
  anthropic: {
    "claude-3-5-sonnet-20240620": { tokens: 200000 },
    "claude-3-opus-20240229": { tokens: 200000 },
    "claude-3-sonnet-20240229": { tokens: 200000 },
    "claude-3-haiku-20240307": { tokens: 200000 },
    "claude-2.1": { tokens: 200000 },
    "claude-2.0": { tokens: 100000 },
    "claude-instant-1.2": { tokens: 100000 },
  },
  lmstudio: {
    "MaziyarPanahi/Codestral-22B-v0.1-GGUF": { tokens: 32768, notes: "Example, user must have this model" },
    "Meta-Llama-3-8B-Instruct-GGUF": {tokens: 8192, notes: "Example, user must have this model"},
    "instructlab/granite-7b-lab-GGUF": { tokens: 2048, notes: "Example, user must have this model" },
  },
  ollama: {
    "command-r": {tokens: 128000, notes: "Example, user must have this model"},
    "codestral": { tokens: 32768, notes: "Example, user must have this model"},
    "mixtral": { tokens: 32768, notes: "Example, user must have this model" },
    "codegemma": {tokens: 16384, notes: "Example, user must have this model"},
    "llama3": { tokens: 8192, notes: "Example, user must have this model" },
    "mistral": { tokens: 8192, notes: "Base Mistral 7B often 8k, can be 32k with sliding window. User must have this model." },
    "gemma": {tokens: 8192, notes: "Example, user must have this model"},
  }
};

// Retry settings
export const MAX_RETRIES = 5; // Increased from 3
export const RETRY_DELAY_MS = 7000; // Increased from 5000ms
export const GROQ_TPM_RETRY_TOKEN_LIMIT = 5000; // Keep this as a reference, but dynamic delay will be primary

export const getLocalStorageApiKeyName = (providerId: LLMProviderId) => `codealchemist_apikey_${providerId}`;
export const getLocalStorageModelName = (providerId: LLMProviderId) => `codealchemist_modelname_${providerId}`;
export const LOCALSTORAGE_PROVIDER_ID_KEY = 'codealchemist_llm_provider_id';
export const LOCALSTORAGE_GIT_REPO_URL_KEY = 'codealchemist_git_repository_url';
export const LOCALSTORAGE_GIT_USERNAME_KEY = 'codealchemist_git_username';
export const LOCALSTORAGE_GIT_EMAIL_KEY = 'codealchemist_git_email';
export const LOCALSTORAGE_GIT_PAT_KEY = 'codealchemist_git_pat';
