import { loadEnv } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendPort = env.VITE_BACKEND_PORT || '8080';
  const backendUrl = env.VITE_BACKEND_URL || `http://localhost:${backendPort}`;

  return {
    base: './',
    plugins: [react()],
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
