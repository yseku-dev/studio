// src/config/llm-config.ts

export const DEFAULT_LLM_PROVIDER = "ollama"; 

export interface LLMProvider {
  id: LLMProviderId;
  name: string;
  apiUrl: string; 
  apiKeyName: string | null; 
  requiresApiKey: boolean;
  isGroqCompatible?: boolean; 
  isAnthropicCompatible?: boolean;
  isOllamaCompatible?: boolean; 
  isGoogleGenerativeAICompatible?: boolean; // New flag for Gemini
}

export const LLM_PROVIDERS: readonly LLMProvider[] = [
  { id: "groq", name: "Groq", apiUrl: "https://api.groq.com/openai/v1", apiKeyName: "GROQ_API_KEY", requiresApiKey: true, isGroqCompatible: true },
  { id: "openai", name: "OpenAI", apiUrl: "https://api.openai.com/v1", apiKeyName: "OPENAI_API_KEY", requiresApiKey: true, isGroqCompatible: true },
  { id: "anthropic", name: "Anthropic", apiUrl: "https://api.anthropic.com/v1", apiKeyName: "ANTHROPIC_API_KEY", requiresApiKey: true, isAnthropicCompatible: true },
  { id: "google-gemini", name: "Google Gemini", apiUrl: "https://generativelanguage.googleapis.com/v1beta/models", apiKeyName: "GOOGLE_API_KEY", requiresApiKey: true, isGoogleGenerativeAICompatible: true },
  { id: "lmstudio", name: "LM Studio", apiUrl: "http://localhost:1234/v1", apiKeyName: "LMSTUDIO_API_KEY", requiresApiKey: false, isGroqCompatible: true }, 
  { id: "ollama", name: "Ollama", apiUrl: "http://127.0.0.1:11434/v1", apiKeyName: "OLLAMA_API_KEY", requiresApiKey: false, isGroqCompatible: true, isOllamaCompatible: true }, 
] as const;

export type LLMProviderId = typeof LLM_PROVIDERS[number]['id'];

export interface ModelInfo {
  tpm?: number;
  tokens?: number;
  notes?: string;
}

export const MODELS_BY_PROVIDER: Record<LLMProviderId, Record<string, ModelInfo>> = {
  groq: {
    "compound-beta": { tpm: 70000, tokens: 131072, notes: "Large context, high throughput (alpha)" },
    "compound-beta-mini": { tpm: 70000, tokens: 131072, notes: "Smaller version of compound-beta (alpha)" },
    "meta-llama/Llama-4-70b-hf": { tpm: 12000, tokens: 131072, notes: "Hypothetical Llama 4 70B, large context" }, // Placeholder, adjust if Groq adds official Llama 4
    "llama-3.1-70b-versatile": { tpm: 12000, tokens: 131072, notes: "131k context" },
    "meta-llama/llama-4-scout-17b-16e-instruct": { tpm: 30000, tokens: 16384, notes: "16k context, fast instruct model" },
    "gemma2-9b-it": { tpm: 15000, tokens: 8192, notes: "8k context, good all-rounder" },
    "llama-guard-3-8b": { tpm: 15000, tokens: 8192, notes: "8k context, safety-focused" },
    "llama3-70b-8192": { tpm: 6000, tokens: 8192, notes: "Original Llama3 70B" },
    "llama-3.1-8b-instant": { tpm: 6000, tokens: 131072, notes: "131k context, fast" },
    "meta-llama/llama-4-maverick-17b-128e-instruct": { tpm: 6000, tokens: 128000, notes: "128k context, versatile instruct" },
    "llama3-8b-8192": { tpm: 6000, tokens: 8192, notes: "Original Llama3 8B" },
    "deepseek-r1-distill-llama-70b": { tpm: 6000, tokens: 32768, notes: "Large context, distilled model" },
    "mistral-saba-24b": { tpm: 6000, tokens: 32768, notes: "Balanced performance and context" },
    "qwen-qwq-32b": { tpm: 6000, tokens: 32768, notes: "Good multilingual capabilities" },
    "allam-2-7b": { tpm: 6000, tokens: 8192, notes: "Arabic-focused model" },
  },
  openai: {
    "gpt-4o": { tokens: 128000, notes: "Latest flagship model, multimodal" },
    "gpt-4-turbo": { tokens: 128000, notes: "Includes gpt-4-turbo-2024-04-09, high performance" },
    "gpt-4": { tokens: 8192, notes: "Solid all-rounder, older version" },
    "gpt-4-32k": { tokens: 32768, notes: "Larger context version of GPT-4" },
    "gpt-3.5-turbo": { tokens: 16385, notes: "Fast and cost-effective, good for many tasks" },
  },
  anthropic: {
    "claude-3-5-sonnet-20240620": { tokens: 200000, notes: "Latest Sonnet, very large context" },
    "claude-3-opus-20240229": { tokens: 200000, notes: "Most powerful Claude 3 model" },
    "claude-3-sonnet-20240229": { tokens: 200000, notes: "Balanced Claude 3 model" },
    "claude-3-haiku-20240307": { tokens: 200000, notes: "Fastest Claude 3 model" },
    "claude-2.1": { tokens: 200000, notes: "Previous generation, large context" },
    "claude-2.0": { tokens: 100000, notes: "Older Claude 2" },
    "claude-instant-1.2": { tokens: 100000, notes: "Fast and affordable Claude" },
  },
  "google-gemini": {
    "gemini-1.5-pro-latest": { tokens: 1048576, notes: "Latest Pro model, 1M context (can be up to 2M for some use cases)" }, // Max input 1M, output up to 8192
    "gemini-1.5-flash-latest": { tokens: 1048576, notes: "Latest Flash model, 1M context, optimized for speed" }, // Max input 1M, output up to 8192
    "gemini-1.0-pro": { tokens: 32768, notes: "Older Pro model, 32k context" }, // 30720 input, 2048 output
    // "gemini-pro-vision": { tokens: 16384, notes: "Multimodal for vision tasks, specific use" }, // Requires different handling for images
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

export const MAX_RETRIES = 5; 
export const RETRY_DELAY_MS = 7000; 
export const GROQ_TPM_RETRY_TOKEN_LIMIT = 5000; 

export const getLocalStorageApiKeyName = (providerId: LLMProviderId) => `codealchemist_apikey_${providerId}`;
export const getLocalStorageModelName = (providerId: LLMProviderId) => `codealchemist_modelname_${providerId}`;
export const LOCALSTORAGE_PROVIDER_ID_KEY = 'codealchemist_llm_provider_id';
export const LOCALSTORAGE_GIT_REPO_URL_KEY = 'codealchemist_git_repository_url';
export const LOCALSTORAGE_GIT_USERNAME_KEY = 'codealchemist_git_username';
export const LOCALSTORAGE_GIT_EMAIL_KEY = 'codealchemist_git_email';
export const LOCALSTORAGE_GIT_PAT_KEY = 'codealchemist_git_pat';
