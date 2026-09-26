# Handoff — TASK-007 — implementação (esqueleto do frontend)

| Campo | Valor |
|-------|-------|
| **Data/hora** | 2026-09-26 14:56 (UTC-3, Brasília) |
| **Tarefa** | `tasks/in-progress/TASK-007-esqueleto-frontend.md` |
| **Etapa concluída** | planejamento + testes + implementação |
| **Papel exercido** | Planejador, Engenheiro de testes e Implementador (um único agente, declarado conforme AGENTS.md § 3) |
| **Ferramenta/agente** | Claude Code 2.1.280 (modelo Opus 5.5), app desktop |
| **Branch** | `task/TASK-007-esqueleto-frontend`, a partir de `development` @ `c0955b2` |
| **Duração aproximada** | ~25 min |

---

## 1. Objetivo desta etapa

Criar o esqueleto do frontend com gates locais e de CI.

## 2. O que foi feito

- Gerei `frontend/` com `npm create vite@latest frontend -- --template react-ts --no-interactive`
  (Vite 8, React 19, TypeScript 6).
- Troquei o oxlint do template pelo ESLint (ADR-012), com typescript-eslint, react-hooks,
  react-refresh e a regra `no-restricted-imports` que proíbe `three` fora de `src/three/` (ADR-005).
- Adicionei `three` e, como dev, `@types/three`, Vitest e Prettier; ativei `"strict": true` no
  `tsconfig.app.json` (o template não o declarava) e incluí `tests/` na checagem de tipos.
- Removi o boilerplate (logos, contador, CSS, README do template). App mínimo em `src/app/App.tsx`;
  `createScene` em `src/three/scene/` com teste em `tests/three/`.
- Job `quality` do CI virou "Frontend (lint, formatação, tipos, testes, build)", com `actions/setup-node@v4`
  (tag conferida: existe) e os mesmos comandos do guia.
- `docs/development-guide.md`: comandos e convenções reais do frontend; menções antigas a "TASK-005"
  corrigidas. `.gitignore`: `.claude/worktrees/` (cópias de trabalho dos agentes em paralelo).

## 3. Arquivos modificados

```text
 M .github/workflows/ci.yml
 M .gitignore
 M docs/development-guide.md
?? frontend/  (package.json, package-lock.json, eslint.config.js, vite.config.ts, tsconfig*.json,
              .prettierrc.json, .prettierignore, .gitignore, index.html, public/favicon.svg,
              src/main.tsx, src/app/App.tsx, src/three/scene/createScene.ts, tests/three/createScene.test.ts)
?? handoffs/TASK-007.md
?? tasks/in-progress/TASK-007-esqueleto-frontend.md
```

Fora do escopo: nenhum.

## 4. Comandos executados e resultados

| Comando (em `frontend/`) | Resultado | Saída (resumo) |
|---------|-----------|----------------|
| `npm run lint` | ✅ | sem erros |
| `npm run format:check` | ✅ | `All matched files use Prettier code style!` |
| `npm run typecheck` | ✅ | `tsc -b` sem erros |
| `npm test` | ✅ | `Tests 1 passed (1)` |
| `npm run build` | ✅ | `dist/assets/index-*.js 219.79 kB` / `built in 319ms` |
| `npm run lint` com `import { Scene } from 'three'` temporário em `src/app/App.tsx` | ✅ (esperado falhar) | `'three' import is restricted ... Importe Three.js só dentro de src/three/ (ADR-005)`; arquivo restaurado, lint volta a 0 erros |
| validação do YAML do CI | ✅ | job `quality` com checkout, setup-node, `npm ci`, lint, format:check, typecheck, test, build |
| `bash scripts/check-structure.sh` | ⚠️ ver § 7 | antes da tarefa em in-progress: `OK: 0 erros, 1 aviso(s)` |

## 5. Decisões tomadas

- ESLint em vez do oxlint do template, porque o ADR-012 (aceito) define ESLint.
- Pastas planejadas do frontend (domain, application, infrastructure, presentation, camera, controls...)
  não foram criadas vazias; entram com o primeiro arquivo de cada uma.

## 6. Regras de negócio aplicadas

- nenhuma

## 7. O que NÃO foi feito e por quê

- PoC Three.js/`CraneController`: próxima tarefa.
- Nesta branch (base anterior à TASK-006), o `check-structure.sh` ainda exige que `handoffs/current.md`
  mencione a TASK-007. Com a TASK-006 mergeada, o CI do PR (que roda sobre o merge com `development`)
  aceita o `handoffs/TASK-007.md`.

## 8. Pendências / decisões necessárias (para a pessoa responsável)

- nenhuma nova (ver `handoffs/current.md`)

## 9. ⚠️ Segurança

- nada a relatar

## 10. Próximo passo

**Papel:** Pessoa responsável — mergear depois da TASK-006, com o job Frontend verde (squash).

## 11. Como revisar este trabalho

- Comece por `frontend/eslint.config.js`, `frontend/package.json` (scripts) e o job `quality` do `ci.yml`.
- `package-lock.json` é gerado.
