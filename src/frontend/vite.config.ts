import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['newchat.clnkj.de'],
    proxy: {
      '/api': {
        target: 'http://localhost:3101',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3101',
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    allowedHosts: ['newchat.clnkj.de'],
  },
});
