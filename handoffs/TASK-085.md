# Handoff — TASK-085

- `startsPhase(points, point)` em `frontend/src/app/planning/usePlanPlayback.ts`. O `onKeyframe` de `PlanningSection.tsx` ignora quadros repetidos da mesma fase.
- Alternativa não feita: tirar o `hold(HOOK)` do backend; isso mudaria a duração da trajetória.
