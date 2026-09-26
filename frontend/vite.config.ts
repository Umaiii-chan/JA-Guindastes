import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  build: {
    // Divisão do pacote (TASK-036): o Three.js e o React saem do chunk da aplicação. Antes, um só
    // chunk de 806,91 kB (acima do aviso de 500 kB). O Three.js vem de dois módulos já empacotados
    // (build/three.core.js e build/three.module.js), por isso dois grupos; os addons (OrbitControls,
    // GLTFLoader) ficam num terceiro. Sem `includeDependenciesRecursively`, o grupo dos addons não
    // puxa o núcleo do Three.js para dentro dele. Todos continuam carregados na abertura da página
    // (import estático): muda só a divisão em arquivos, não o comportamento.
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'three-addons', test: /[\\/]node_modules[\\/]three[\\/]examples[\\/]/ },
            {
              name: 'three-core',
              test: /[\\/]node_modules[\\/]three[\\/]build[\\/]three\.core\.js/,
            },
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ },
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
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
