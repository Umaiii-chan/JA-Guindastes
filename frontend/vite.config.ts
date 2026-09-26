import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    // Desenvolvimento (TASK-032): `/api`, inclusive o WebSocket `/api/v1/ws/evaluation`, vai ao
    // backend local (`uv run uvicorn app.main:app`, porta 8000). No container, quem faz isso é o
    // nginx (frontend/nginx.conf.template, TASK-027).
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, ws: true },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
