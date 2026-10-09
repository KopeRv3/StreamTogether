import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // API REST
      '/api': {
        target: BACKEND,
        changeOrigin: true,
      },
      // Archivos subidos (video local)
      '/uploads': {
        target: BACKEND,
        changeOrigin: true,
      },
      // ESTE ERA EL QUE FALTABA: sin esto el handshake de Socket.IO
      // recibía el index.html de Vite y toda la parte de tiempo real moría.
      // `ws: true` es obligatorio para el upgrade a WebSocket.
      '/socket.io': {
        target: BACKEND,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});