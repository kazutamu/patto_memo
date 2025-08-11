import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MockHTMLVideoElement, MockMediaStream, MockCanvasRenderingContext2D } from './setup';

// Custom render function that includes common providers if needed
const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  return render(ui, options);
};

// Mock video element helpers
export const createMockVideoElement = (overrides: Partial<MockHTMLVideoElement> = {}): HTMLVideoElement => {
  const video = new MockHTMLVideoElement() as unknown as HTMLVideoElement;
  Object.assign(video, overrides);
  return video;
};

// Mock canvas context helpers
export const createMockCanvas = () => {
  const canvas = document.createElement('canvas') as HTMLCanvasElement;
  const context = canvas.getContext('2d') as unknown as MockCanvasRenderingContext2D;
  return { canvas, context };
};

// Mock media stream helpers
export const createMockMediaStream = () => {
  return new MockMediaStream() as unknown as MediaStream;
};

// Create mock image data with specific pixel patterns for testing motion detection
export const createMockImageData = (width: number = 320, height: number = 240, pattern: 'black' | 'white' | 'noise' = 'black'): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < data.length; i += 4) {
    switch (pattern) {
      case 'black':
        data[i] = 0;     // R
        data[i + 1] = 0; // G
        data[i + 2] = 0; // B
        data[i + 3] = 255; // A
        break;
      case 'white':
        data[i] = 255;     // R
        data[i + 1] = 255; // G
        data[i + 2] = 255; // B
        data[i + 3] = 255; // A
        break;
      case 'noise':
        data[i] = Math.floor(Math.random() * 256);     // R
        data[i + 1] = Math.floor(Math.random() * 256); // G
        data[i + 2] = Math.floor(Math.random() * 256); // B
        data[i + 3] = 255; // A
        break;
    }
  }
  
  return {
    data,
    width,
    height,
    colorSpace: 'srgb'
  } as ImageData;
};

// Create mock image data with specific pixel differences for motion testing
export const createImageDataWithMotion = (width: number = 320, height: number = 240, motionIntensity: number = 50): { static: ImageData; withMotion: ImageData } => {
  const staticData = new Uint8ClampedArray(width * height * 4);
  const motionData = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < staticData.length; i += 4) {
    // Static frame - mostly black
    staticData[i] = 50;     // R
    staticData[i + 1] = 50; // G
    staticData[i + 2] = 50; // B
    staticData[i + 3] = 255; // A
    
    // Motion frame - add some change based on motionIntensity
    const change = Math.floor(motionIntensity * 2.55); // Convert percentage to 0-255
    motionData[i] = Math.min(255, 50 + change);     // R
    motionData[i + 1] = Math.min(255, 50 + change); // G
    motionData[i + 2] = Math.min(255, 50 + change); // B
    motionData[i + 3] = 255; // A
  }
  
  return {
    static: {
      data: staticData,
      width,
      height,
      colorSpace: 'srgb'
    } as ImageData,
    withMotion: {
      data: motionData,
      width,
      height,
      colorSpace: 'srgb'
    } as ImageData
  };
};

// Wait for next tick
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));

// Wait for multiple ticks
export const waitForTicks = (ticks: number) => {
  return new Promise(resolve => {
    let count = 0;
    const tick = () => {
      count++;
      if (count >= ticks) {
        resolve(undefined);
      } else {
        setTimeout(tick, 0);
      }
    };
    tick();
  });
};

// Mock performance.now for consistent timing
export const mockPerformanceNow = (timestamp: number = 0) => {
  vi.spyOn(performance, 'now').mockReturnValue(timestamp);
};

export * from '@testing-library/react';
export { customRender as render };