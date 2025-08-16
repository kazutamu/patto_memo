import { MotionEvent, MotionEventCreate, MotionSettings } from './types';

const API_BASE_URL = '/api/v1';

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

export interface LLaVAAnalysisRequest {
  image_base64: string;
  prompt?: string;
  prompt_type?: 'default' | 'detailed' | 'quick' | 'security';
}

export interface LLaVAAnalysisResponse {
  description: string;
  processing_time: number;
  llm_model: string;
  success: boolean;
  error_message?: string;
}

export interface StreamChunk {
  type: 'status' | 'chunk' | 'complete' | 'error';
  content?: string;
  full_response?: string;
  processing_time?: number;
  message?: string;
  timestamp?: string;
  queue_status?: QueueStatus;
}

export interface QueueStatus {
  queue_size: number;
  is_dropping: boolean;
  avg_processing_time: number;
}

export const api = {
  // Get motion events
  getMotionEvents: async (limit?: number): Promise<MotionEvent[]> => {
    const params = limit ? `?limit=${limit}` : '';
    return request<MotionEvent[]>(`/motion/events${params}`);
  },

  // Create a new motion event
  createMotionEvent: async (event: MotionEventCreate): Promise<MotionEvent> => {
    return request<MotionEvent>('/motion/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  },

  // Get motion detection settings
  getMotionSettings: async (): Promise<MotionSettings> => {
    return request<MotionSettings>('/motion/settings');
  },

  // Analyze image with LLaVA
  analyzeLLaVA: async (analysisRequest: LLaVAAnalysisRequest): Promise<LLaVAAnalysisResponse> => {
    return request<LLaVAAnalysisResponse>('/llava/analyze', {
      method: 'POST',
      body: JSON.stringify(analysisRequest),
    });
  },

  // Analyze image with LLaVA using streaming
  analyzeLLaVAStream: async function* (analysisRequest: LLaVAAnalysisRequest): AsyncGenerator<StreamChunk> {
    const url = `${API_BASE_URL}/llava/analyze-stream`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisRequest),
      });

      if (!response.ok) {
        throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body available for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // Map the backend response format to our StreamChunk format
                if (data.status === 'analyzing') {
                  yield { type: 'status', timestamp: data.timestamp };
                } else if (data.status === 'streaming') {
                  yield { 
                    type: 'chunk', 
                    content: data.chunk,
                    timestamp: data.timestamp 
                  };
                } else if (data.status === 'completed') {
                  yield { 
                    type: 'complete', 
                    full_response: data.description,
                    processing_time: data.processing_time,
                    timestamp: data.timestamp 
                  };
                  return;
                } else if (data.status === 'error') {
                  yield { 
                    type: 'error', 
                    message: data.error,
                    timestamp: data.timestamp 
                  };
                  return;
                }
              } catch (e) {
                console.warn('Failed to parse streaming data:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, `Streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};