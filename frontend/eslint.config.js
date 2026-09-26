import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // ADR-005: a lógica 3D fica em controllers/adapters próprios (src/three/), não nos componentes React.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/three/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'three', message: 'Importe Three.js só dentro de src/three/ (ADR-005).' },
          ],
          patterns: [
            { group: ['three/*'], message: 'Importe Three.js só dentro de src/three/ (ADR-005).' },
          ],
        },
      ],
    },
  },
])
