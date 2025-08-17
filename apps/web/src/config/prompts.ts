/**
 * Centralized prompt configuration for LLaVA analysis
 */
export const LLAVA_PROMPTS = {
  detailed: "Provide a detailed description of what you see",
  security: "Identify any security concerns or unusual activity",
} as const;

export const MOTION_CONFIG = {
  defaultSensitivity: 0.5,
  significanceThreshold: 0.7,
  aiAnalysisEnabled: true,
} as const;