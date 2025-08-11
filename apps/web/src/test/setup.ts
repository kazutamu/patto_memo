import '@testing-library/jest-dom';

// Mock HTMLCanvasElement and CanvasRenderingContext2D
class MockCanvasRenderingContext2D {
  canvas: HTMLCanvasElement;
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  lineWidth: number = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  drawImage = vi.fn();
  getImageData = vi.fn(() => ({
    data: new Uint8ClampedArray(4 * 320 * 240), // Mock RGBA data for 320x240 canvas
    width: 320,
    height: 240,
  }));
  putImageData = vi.fn();
  clearRect = vi.fn();
  fillRect = vi.fn();
  strokeRect = vi.fn();
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  translate = vi.fn();
  rotate = vi.fn();
  scale = vi.fn();
  setTransform = vi.fn();
  resetTransform = vi.fn();
}

class MockHTMLCanvasElement extends HTMLElement {
  width: number = 320;
  height: number = 240;
  private _context: MockCanvasRenderingContext2D | null = null;

  getContext(contextId: string): MockCanvasRenderingContext2D | null {
    if (contextId === '2d') {
      if (!this._context) {
        this._context = new MockCanvasRenderingContext2D(this as any);
      }
      return this._context;
    }
    return null;
  }

  toDataURL = vi.fn(() => 'data:image/png;base64,mock-data-url');
  toBlob = vi.fn();
}

// Mock HTMLVideoElement
class MockHTMLVideoElement extends HTMLElement {
  readyState: number = 4; // HAVE_ENOUGH_DATA
  videoWidth: number = 1280;
  videoHeight: number = 720;
  duration: number = 0;
  currentTime: number = 0;
  paused: boolean = true;
  ended: boolean = false;
  volume: number = 1;
  muted: boolean = false;
  playbackRate: number = 1;
  src: string = '';
  srcObject: MediaStream | null = null;
  controls: boolean = false;
  autoplay: boolean = false;
  loop: boolean = false;
  playsInline: boolean = false;

  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
  canPlayType = vi.fn(() => '');
  
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

// Mock MediaStream and MediaStreamTrack
class MockMediaStreamTrack {
  kind: string = 'video';
  id: string = 'mock-track-id';
  label: string = 'Mock Camera';
  enabled: boolean = true;
  muted: boolean = false;
  readonly: boolean = false;
  readyState: 'live' | 'ended' = 'live';

  stop = vi.fn();
  clone = vi.fn(() => new MockMediaStreamTrack());
  getSettings = vi.fn(() => ({}));
  getConstraints = vi.fn(() => ({}));
  getCapabilities = vi.fn(() => ({}));
  applyConstraints = vi.fn(() => Promise.resolve());
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

class MockMediaStream {
  id: string = 'mock-stream-id';
  active: boolean = true;
  
  private _tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()];

  getTracks = vi.fn(() => this._tracks);
  getVideoTracks = vi.fn(() => this._tracks.filter(track => track.kind === 'video'));
  getAudioTracks = vi.fn(() => this._tracks.filter(track => track.kind === 'audio'));
  addTrack = vi.fn();
  removeTrack = vi.fn();
  clone = vi.fn(() => new MockMediaStream());
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

// Set up global mocks
Object.defineProperty(globalThis, 'HTMLCanvasElement', {
  value: MockHTMLCanvasElement,
  writable: true,
});

Object.defineProperty(globalThis, 'HTMLVideoElement', {
  value: MockHTMLVideoElement,
  writable: true,
});

// Mock document.createElement to return our mock elements
const originalCreateElement = document.createElement;
document.createElement = vi.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return new MockHTMLCanvasElement() as any;
  }
  if (tagName === 'video') {
    return new MockHTMLVideoElement() as any;
  }
  return originalCreateElement.call(document, tagName);
});

// Mock navigator.mediaDevices.getUserMedia
Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(() => Promise.resolve(new MockMediaStream())),
    enumerateDevices: vi.fn(() => Promise.resolve([])),
    getSupportedConstraints: vi.fn(() => ({})),
  },
  writable: true,
});

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

// Mock Date.now for consistent timestamps in tests
const mockTimestamp = 1640995200000; // 2022-01-01T00:00:00.000Z
vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

// Global test utilities
export { MockCanvasRenderingContext2D, MockHTMLCanvasElement, MockHTMLVideoElement, MockMediaStream, MockMediaStreamTrack };