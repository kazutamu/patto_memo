/**
 * LLaVA AI model related types
 */

// LLaVA analysis request
export interface LLaVAAnalysisRequest {
  image_base64: string;
  prompt?: string;
}

// LLaVA analysis response
export interface LLaVAAnalysisResponse {
  description: string;
  processing_time: number;
  llm_model: string;
  success: boolean;
  error_message?: string | null;
}

// Ollama API request structure
export interface OllamaRequest {
  model: string;
  prompt: string;
  images: string[]; // base64 encoded
  stream?: boolean;
  options?: OllamaOptions;
}

// Ollama API response
export interface OllamaResponse {
  response: string;
  model: string;
  created_at: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Ollama model options
export interface OllamaOptions {
  temperature?: number;
  top_k?: number;
  top_p?: number;
  num_predict?: number;
  stop?: string[];
}