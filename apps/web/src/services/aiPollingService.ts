/**
 * HTTP Polling service for AI analysis - Mobile-friendly fallback
 * Uses REST API instead of WebSocket to avoid mixed content issues
 */

import { AIAnalysisResult, MotionEventForAI } from '../types';

export interface PollingServiceOptions {
  apiUrl?: string;
  pollInterval?: number;
  maxRetries?: number;
}

export class AIPollingService {
  private apiUrl: string;
  private pollInterval: number;
  private maxRetries: number;
  private isPolling = false;
  private pollTimer: number | null = null;
  private pendingJobs = new Map<string, { timestamp: number; retries: number }>();
  private onAnalysisCallback?: (analysis: AIAnalysisResult) => void;

  constructor(options: PollingServiceOptions = {}) {
    // Use environment variable first, then fallback to dynamic detection
    this.apiUrl = options.apiUrl || import.meta.env.VITE_API_URL;
    
    // If no env var, use dynamic host detection
    if (!this.apiUrl || this.apiUrl === '') {
      const host = window.location.hostname;
      const port = import.meta.env.VITE_API_PORT || '8000';
      // For mobile/HTTPS pages, we need to use HTTP for local API
      // This works with Tailscale or local network access
      this.apiUrl = `http://${host}:${port}/api/v1`;
    }
    
    this.pollInterval = options.pollInterval || 2000; // Poll every 2 seconds
    this.maxRetries = options.maxRetries || 3;
    
    console.log('📱 AI Polling Service initialized');
    console.log('📱 API URL:', this.apiUrl);
    console.log('📱 Host:', window.location.hostname);
  }

  /**
   * Set callback for when analysis results are received
   */
  setOnAnalysis(callback: (analysis: AIAnalysisResult) => void) {
    this.onAnalysisCallback = callback;
  }

  /**
   * Submit a frame for AI analysis
   */
  async submitFrameForAnalysis(motionEvent: MotionEventForAI): Promise<boolean> {
    try {
      console.log('📱 Submitting frame via HTTP polling to:', `${this.apiUrl}/ai/analyze-frame`);
      console.log('📱 Frame ID:', motionEvent.frame_id);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${this.apiUrl}/ai/analyze-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frame_id: motionEvent.frame_id,
          frame_data: motionEvent.frame_data,
          motion_strength: motionEvent.motion_strength,
          timestamp: motionEvent.timestamp,
          // Add mobile identifier for backend
          client_type: 'mobile_polling'
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('📱 Failed to submit frame:', response.status, await response.text());
        return false;
      }

      const result = await response.json();
      
      // If analysis is ready immediately, return it
      if (result.status === 'completed' && result.analysis) {
        this.onAnalysisCallback?.(result.analysis);
        return true;
      }
      
      // Otherwise, add to pending jobs for polling
      if (result.status === 'queued' || result.status === 'processing') {
        this.pendingJobs.set(motionEvent.frame_id, {
          timestamp: Date.now(),
          retries: 0
        });
        this.startPolling();
        return true;
      }

      return false;
    } catch (error) {
      console.error('📱 Error submitting frame for analysis:', error);
      if (error.name === 'AbortError') {
        console.error('📱 Request timed out after 10 seconds');
      } else {
        console.error('📱 Network error details:', error.message);
      }
      return false;
    }
  }

  /**
   * Start polling for results
   */
  private startPolling() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    console.log('📱 Starting AI result polling');
    
    this.pollForResults();
  }

  /**
   * Stop polling for results
   */
  stopPolling() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.pendingJobs.clear();
    console.log('📱 Stopped AI result polling');
  }

  /**
   * Poll for analysis results
   */
  private async pollForResults() {
    if (!this.isPolling || this.pendingJobs.size === 0) {
      this.isPolling = false;
      return;
    }

    try {
      // Get all pending frame IDs
      const frameIds = Array.from(this.pendingJobs.keys());
      
      const response = await fetch(`${this.apiUrl}/ai/poll-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frame_ids: frameIds }),
      });

      if (response.ok) {
        const results = await response.json();
        
        // Process completed results
        for (const result of results.completed || []) {
          if (this.pendingJobs.has(result.frame_id)) {
            this.pendingJobs.delete(result.frame_id);
            this.onAnalysisCallback?.(result);
            console.log('📱 Received AI result via polling:', result.frame_id);
          }
        }
        
        // Handle failed results
        for (const failedId of results.failed || []) {
          this.pendingJobs.delete(failedId);
          console.log('📱 AI analysis failed for:', failedId);
        }
      }
      
      // Clean up old jobs (older than 30 seconds)
      const now = Date.now();
      for (const [frameId, job] of this.pendingJobs.entries()) {
        if (now - job.timestamp > 30000) {
          this.pendingJobs.delete(frameId);
          console.log('📱 Cleaning up old job:', frameId);
        }
      }
      
    } catch (error) {
      console.error('Polling error:', error);
    }

    // Continue polling if we still have pending jobs
    if (this.isPolling && this.pendingJobs.size > 0) {
      this.pollTimer = setTimeout(() => this.pollForResults(), this.pollInterval);
    } else {
      this.isPolling = false;
    }
  }

  /**
   * Check if service is active
   */
  isActive(): boolean {
    return this.isPolling || this.pendingJobs.size > 0;
  }

  /**
   * Get number of pending jobs
   */
  getPendingCount(): number {
    return this.pendingJobs.size;
  }
}

// Export singleton instance
export const aiPollingService = new AIPollingService();