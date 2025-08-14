/**
 * API-related types shared across the monorepo
 */

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Health check response
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  sse_connections?: number;
  timestamp?: string;
  version?: string;
}

// Error response
export interface ErrorResponse {
  detail: string;
  status_code?: number;
  type?: string;
}