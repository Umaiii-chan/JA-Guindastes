// A caixa da carga (TASK-041) é lógica pura e passou para `domain/collision/loadBox.ts` (TASK-053),
// onde as colisões a usam sem importar `three/`. Este arquivo mantém os imports antigos funcionando.
export * from '../../domain/collision/loadBox'
