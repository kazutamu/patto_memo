
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface ImageAnalysisRequest {
  image_base64: string;
  prompt?: string;
}

export interface ImageAnalysisResponse {
  description: string;
  detected?: string | null;  // "YES" or "NO" detection status
  processing_time: number;
  llm_model: string;
  success: boolean;
  error_message?: string;
}

export const api = {
  // Analyze image with AI (Gemini)
  analyzeImage: async (analysisRequest: ImageAnalysisRequest): Promise<ImageAnalysisResponse> => {
    return request<ImageAnalysisResponse>('/ai/analyze-image', {
      method: 'POST',
      body: JSON.stringify(analysisRequest),
    });
  },

  // Get available prompts
  getPrompts: async () => {
    return request('/ai/prompts');
  },

  // Health check
  health: async () => {
    return request('/health');
  },
};