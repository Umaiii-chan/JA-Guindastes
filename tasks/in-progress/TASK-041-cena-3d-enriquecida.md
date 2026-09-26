# TASK-041 — Cena 3D enriquecida: ambiente, feedback visual e câmera

| Campo | Valor |
|-------|-------|
| **Status** | in-progress |
| **Prioridade** | média |
| **Criada em** | 2026-09-26 por pessoa responsável (leva D, via orquestrador) |
| **Iniciada em** | 2026-09-26 |
| **Concluída em** | — |
| **Branch** | `task/TASK-041-cena-3d-enriquecida` |
| **PR** | — |
| **Requisitos** | pedido da pessoa responsável em chat ("enriqueça o frontend", visual "Escuro tipo software 3D") |
| **Regras de negócio** | ADR-013 (convenções geométricas; C-7: a geometria do navegador é só pré-visualização); ADR-008 (GLB) |
| **Estimativa** | M |

---

## 1. Objetivo

A cena 3D ganha aparência de software 3D profissional e feedback visual da operação, sem mudar a
cinemática nem o cálculo.

## 2. Contexto

Leva D. Tarefas paralelas:
- TASK-039: páginas e design system; ela consome o `CraneViewport`.
- TASK-038: backend.

Esta tarefa fica restrita a `frontend/src/three/**` e ao `CraneViewport`. Mudanças na API pública do
viewport devem ser **aditivas** (props opcionais), para não quebrar a TASK-039.

## 3. Critérios de aceite

- [ ] **CA-1** — Ambiente escuro:
  - fundo em gradiente ou céu escuro, grafite ou azulado, coerente com o tema;
  - chão com grade técnica: linhas principais a cada 5 m e secundárias a cada 1 m, esmaecendo com a
    distância;
  - luz hemisférica mais uma direcional, com sombras suaves no chão;
  - tone mapping ACES e cor em sRGB.
- [ ] **CA-2** — Anel de raio no chão:
  - círculo no raio de trabalho da pré-visualização, centrado no eixo de giro;
  - rótulo com o valor em metros;
  - arco de alcance (raio mínimo e máximo) em linha tênue.
- [ ] **CA-3** — Feedback de situação:
  - prop opcional `evaluationStatus` (`'ok' | 'warning' | 'over' | 'unknown'`);
  - colore o anel e um halo sutil na carga ou no gancho: verde, âmbar, vermelho ou cinza;
  - as cores ficam centralizadas em `src/three/scene/palette.ts`, para a TASK-039 alinhar os tokens
    CSS do ADR-017.
- [ ] **CA-4** — Carga visível: com a prop opcional `load` (comprimento, largura e altura em metros), a
  cena desenha uma caixa pendurada no gancho pelo cabo; sem carga, fica só o gancho.
- [ ] **CA-5** — Câmera:
  - predefinições `'perspectiva' | 'lateral' | 'topo' | 'operador'`, acessíveis por API imperativa ou
    por prop;
  - transição suave entre elas, desligada com `prefers-reduced-motion`;
  - limites de zoom e de ângulo, para a câmera não atravessar o chão.
- [ ] **CA-6** — Desempenho:
  - sombras e antialiasing ajustados para 60 fps num notebook comum;
  - a renderização pausa quando a aba fica oculta;
  - `dispose` correto: os testes de ciclo de vida existentes continuam passando.
- [ ] **CA-7** — Testes Vitest para a lógica nova: geometria do anel e do arco, cor por situação, caixa
  da carga e predefinições de câmera. Os gates do frontend e os testes E2E da cena passam.

## 4. Escopo

### Dentro do escopo

`frontend/src/three/**`, `frontend/src/presentation/components/CraneViewport.tsx` (só props aditivas)
e os testes correspondentes em `frontend/tests/three/**`.

### Fora do escopo (explicitamente — o agente NÃO faz)

- páginas, painéis e design system (TASK-039);
- modelo 3D real, que aguarda o arquivo da pessoa responsável;
- `backend/**`, docs gerais e `handoffs/current.md`.

## 5. Arquivos provavelmente afetados

| Arquivo | Tipo de mudança | Verificado? |
|---------|-----------------|-------------|
| `frontend/src/three/scene/*` | alterar/criar | sim |
| `frontend/src/three/camera/*` | alterar | sim |
| `frontend/src/presentation/components/CraneViewport.tsx` | alterar (aditivo) | sim |

## 6. Riscos e dependências

- Na integração, a TASK-039 passa a enviar `evaluationStatus`, `load` e a câmera ao viewport. O handoff
  deve documentar essas props e como ligá-las.

## 7. Teste manual (se houver)

1. Rodar `npm run dev`.
2. Mover os controles e conferir o anel e as cores.
3. Trocar as predefinições de câmera.
