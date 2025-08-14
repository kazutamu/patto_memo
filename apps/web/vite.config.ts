/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    // Only enable SSL in non-CI environments for mobile camera support
    ...(process.env.CI ? [] : [basicSsl()])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@motion-detector/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@motion-detector/shared-utils': path.resolve(__dirname, '../../packages/shared-utils/src'),
    },
  },
  server: {
    host: '0.0.0.0', // Bind to all interfaces
    port: 3000,
    https: !process.env.CI, // Disable SSL in CI environment
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
})