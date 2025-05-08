// src/config/llm-config.ts

export const DEFAULT_LLM_PROVIDER = "groq";

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
    // Ordered by TPM (descending), then by name for stability
    "compound-beta": { tpm: 70000 },
    "compound-beta-mini": { tpm: 70000 },
    "meta-llama/llama-4-scout-17b-16e-instruct": { tpm: 30000 },
    "gemma2-9b-it": { tpm: 15000 },
    "llama-guard-3-8b": { tpm: 15000 },
    "llama-3.1-70b-versatile": { tpm: 12000, tokens: 8192 }, // Assuming 8k tokens like llama3-70b-8192 if not specified
    "llama3-70b-8192": { tpm: 6000, tokens: 8192 },
    "llama3-8b-8192": { tpm: 6000, tokens: 8192 },
    "deepseek-r1-distill-llama-70b": { tpm: 6000 },
    "meta-llama/llama-4-maverick-17b-128e-instruct": { tpm: 6000 },
    "mistral-saba-24b": { tpm: 6000 },
    "qwen-qwq-32b": { tpm: 6000 },
    "allam-2-7b": { tpm: 6000 },
    "llama-3.1-8b-instant": { tpm: 6000, tokens: 8192 }, // Assuming 8k if not specified
  },
  openai: {
    "gpt-4o": { tokens: 128000 },
    "gpt-4-turbo": { tokens: 128000 }, // Includes gpt-4-turbo-2024-04-09
    "gpt-4": { tokens: 8192 },
    "gpt-4-32k": { tokens: 32768 },
    "gpt-3.5-turbo": { tokens: 16385, notes: "Supports 16k context, use gpt-3.5-turbo-0125 for latest" }, // Covers 4k and 16k variants, latest is 16k by default for some versions.
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
  lmstudio: { // These are examples, user loads their own models in LMStudio. Add from python script
    "instructlab/granite-7b-lab-GGUF": { tokens: 2048 },
    "MaziyarPanahi/Codestral-22B-v0.1-GGUF": { tokens: 32768 },
    "Meta-Llama-3-8B-Instruct-GGUF": {tokens: 8192, notes: "Example, user must have this model"},
    "Mixtral-8x7B-Instruct-v0.1-GGUF": {tokens: 32768, notes: "Example, user must have this model"},
  },
  ollama: { // User pulls models into Ollama
    "llama3": { tokens: 8192 },
    "codestral": { tokens: 32768, notes: "Example, user must have this model"},
    "mistral": { tokens: 8192 }, // Base Mistral 7B often 8k, can be 32k with sliding window
    "mixtral": { tokens: 32768 },
    "gemma": {tokens: 8192},
    "command-r": {tokens: 128000},
    "codegemma": {tokens: 16384}
  }
};

// Retry settings from Python config
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 2000; // in seconds in python, converted to ms
export const GROQ_TPM_RETRY_TOKEN_LIMIT = 5000; // Specific to Groq for TPM based retry logic, may not apply to others.

export const getLocalStorageApiKeyName = (providerId: LLMProviderId) => `codealchemist_apikey_${providerId}`;
export const getLocalStorageModelName = (providerId: LLMProviderId) => `codealchemist_modelname_${providerId}`;
export const LOCALSTORAGE_PROVIDER_ID_KEY = 'codealchemist_llm_provider_id';
export const LOCALSTORAGE_GIT_REPO_URL_KEY = 'codealchemist_git_repository_url';
export const LOCALSTORAGE_GIT_USERNAME_KEY = 'codealchemist_git_username';
export const LOCALSTORAGE_GIT_EMAIL_KEY = 'codealchemist_git_email';
export const LOCALSTORAGE_GIT_PAT_KEY = 'codealchemist_git_pat';
