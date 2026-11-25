# Handoff — TASK-125 — tandem planejado move os dois guindastes

> Tarefa em paralelo: `handoffs/current.md` não foi editado.

| Campo | Valor |
|-------|-------|
| **Tarefa** | `tasks/in-progress/TASK-125-tandem-planejado-move-dois.md` |
| **Papel** | Engenheiro de testes + Implementador (uma sessão; revisão pendente) |
| **Branch** | `task/TASK-125-tandem-planejado-move-dois`, de `origin/development` @ `66dc26b` |

## 1. Causa (verifiquei no código)

`PlanningSection` só tocava `trajectoryOfCrane(trajectory, 0)` e `usePlanPlayback` só comandava um guindaste.
Os quadros do Guindaste 2 (`craneIndex` 1, mesmos instantes) vinham do backend e eram ignorados. O
Guindaste 2 só se movia **depois do engate**, e então pela cinemática inversa do tandem da cena
(`MultiCrane.syncTandem`, ADR-037), nunca pelos quadros do plano: na aproximação ficava parado. Era a
consequência do desenho do TASK-075/074, não um erro de regra; **não mudei regra**: o engate continua sendo
conduzido pela cena.
A lista mista (tandem + single válido, TASK-123) não muda a seleção nem a trajetória tocada: o seguidor só
entra quando a recomendação selecionada é `tandem`.

## 2. O que mudou

- `usePlanPlayback`: opção `follower` (`points`, `getCommands`, `isEngaged`); aplica os quadros do Guindaste 2
  junto com os do 1 (quadros-chave e amostras) enquanto os ganchos não estão presos.
- `mountCraneScene`/`CraneViewport`: `isTandemEngaged()` (leitura imediata do `MultiCrane`).
- `PlanningSection`: `getFollower` e os quadros do índice 1; `SimulatorRoute` entrega os comandos do seguidor.
- Texto do aviso do tandem e L-020 em `docs/known-gaps.md`.

## 3. Verificação

- `usePlanPlayback.test.tsx`: 3 testes novos; 2 falhavam antes (o seguidor ficava em 0), todos passam agora.
- `tsc -b`, `tsc -p e2e`, eslint: sem erros. `vitest run --maxWorkers=6` (suíte inteira): 150 arquivos, 1385 testes passaram.
- Backend: não tocado.
- **NÃO EXECUTADO: na tela com backend real.** Não está provado que o Guindaste 2 anda de verdade na cena
  (a ligação `getFollower` → comandos do extra) nem que a guarda de colisão do seguidor aceita o caminho.

## 4. Próximo passo

Revisor + conferir na tela: Aplicar o tandem e Executar; ver os dois se moverem da aproximação à soltura.
