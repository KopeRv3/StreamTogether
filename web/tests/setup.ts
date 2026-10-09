import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Tras cada prueba se desmonta lo renderizado para no arrastrar estado
afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom no implementa estas APIs y el player de YouTube las usa
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

if (!window.HTMLMediaElement.prototype.load) {
  window.HTMLMediaElement.prototype.load = vi.fn();
}

Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: vi.fn(),
});