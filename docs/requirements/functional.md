# Requisitos funcionais

Transcrição literal da [documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md), § 4
(TASK-002, 2026-09-26). A coluna **Requisito** é cópia exata da doc-fonte.

- **Status:** todos `Proposto` até a pessoa responsável aprovar.
- **Critérios de aceite:** a doc-fonte não traz critérios por requisito. Eles são escritos no formato
  de [`README.md`](README.md) quando o requisito virar tarefa; até lá, a referência é a Definition of
  Done do MVP (doc-fonte § 24).
- **Prioridade:** convertida para MoSCoW (Deve → Must, Deveria → Should, Poderia → Could); a
  coluna "Doc-fonte" mostra o termo original.
- **Tarefas:** as que implementaram (total ou parcialmente) o requisito, tiradas do campo
  "Requisitos" de cada arquivo em `tasks/completed/` e, para a leva C (TASK-033..036, mesclada no
  PR #34), em `tasks/in-progress/` (TASK-037). Não
  entram a TASK-002 (registrou todos os requisitos) nem a TASK-009 (só o ADR-013). Uma tarefa listada
  **não** significa requisito atendido: o status continua decisão da pessoa responsável.

| ID | Requisito | Prioridade | Doc-fonte | Status | Tarefas |
|----|-----------|------------|-----------|--------|---------|
| RF-001 | Cadastrar fabricantes de guindastes. | Must | Deve (l.94) | Proposto | TASK-022, TASK-030, TASK-033 |
| RF-002 | Cadastrar modelos de guindastes. | Must | Deve (l.95) | Proposto | TASK-022, TASK-030, TASK-033 |
| RF-003 | Importar modelo 3D de um guindaste em formato interno GLB/glTF. | Must | Deve (l.96) | Proposto | TASK-026 (leitura no navegador, sem upload) |
| RF-004 | Configurar escala, orientação e nós/articulações do modelo 3D. | Must | Deve (l.97) | Proposto | TASK-026 |
| RF-005 | Cadastrar múltiplas configurações operacionais para um guindaste. | Must | Deve (l.98) | Proposto | TASK-022, TASK-030, TASK-033 |
| RF-006 | Importar tabela de carga em CSV/XLSX. | Must | Deve (l.99) | Proposto | TASK-010, TASK-019, TASK-023, TASK-031, TASK-034 |
| RF-007 | Vincular uma tabela de carga a uma configuração específica do guindaste. | Must | Deve (l.100) | Proposto | TASK-022, TASK-031, TASK-034 |
| RF-008 | Preservar metadados e documento-fonte da tabela importada. | Must | Deve (l.101) | Proposto | TASK-010 (parcial), TASK-022, TASK-031, TASK-034 |
| RF-009 | Validar e normalizar unidades e pontos da tabela. | Must | Deve (l.102) | Proposto | TASK-010, TASK-019, TASK-023, TASK-031 |
| RF-010 | Selecionar guindaste e configuração para uma nova simulação. | Must | Deve (l.103) | Proposto | TASK-030 (listagem e leitura pela API), TASK-033 (seleção na tela) |
| RF-011 | Criar/configurar carga com peso e dimensões. | Must | Deve (l.104) | Proposto | TASK-028, TASK-029, TASK-034 |
| RF-012 | Manipular giro da superestrutura/torre. | Must | Deve (l.105) | Proposto | TASK-013 (visual) |
| RF-013 | Manipular inclinação e comprimento/extensão da lança. | Must | Deve (l.106) | Proposto | TASK-013 (visual) |
| RF-014 | Manipular comprimento do cabo/posição do gancho. | Must | Deve (l.107) | Proposto | TASK-013 (visual) |
| RF-015 | Calcular raio de trabalho e altura/posição do gancho em tempo de execução. | Must | Deve (l.108) | Proposto | TASK-014, TASK-015, TASK-016, TASK-024, TASK-025, TASK-029, TASK-032 |
| RF-016 | Consultar ou interpolar a capacidade correspondente na tabela vinculada. | Must | Deve (l.109) | Proposto | TASK-008, TASK-015, TASK-020, TASK-024, TASK-025, TASK-029, TASK-032 |
| RF-017 | Comparar carga informada com a capacidade calculada. | Must | Deve (l.110) | Proposto | TASK-008, TASK-015, TASK-024, TASK-025, TASK-028, TASK-029, TASK-032 |
| RF-018 | Exibir capacidade, utilização, raio, comprimento de lança e status da operação. | Must | Deve (l.111) | Proposto | TASK-015, TASK-024, TASK-025, TASK-029, TASK-032 |
| RF-019 | Emitir alertas em tempo real quando uma regra operacional for violada. | Must | Deve (l.112) | Proposto | — (níveis de alerta pendentes, PEND-004; a TASK-032 cita RF-015..020, mas não tem alerta) |
| RF-020 | Rejeitar ou sinalizar consulta fora do domínio suportado pela tabela. | Must | Deve (l.113) | Proposto | TASK-008, TASK-015, TASK-020, TASK-024, TASK-025, TASK-029, TASK-032 |
| RF-021 | Salvar uma simulação e seu estado relevante. | Should | Deveria (l.114) | Proposto | — |
| RF-022 | Consultar simulações previamente salvas. | Should | Deveria (l.115) | Proposto | — |
| RF-023 | Exportar um resumo técnico da simulação. | Could | Poderia (l.116) | Proposto | — |
| RF-024 | Permitir cadastrar obstáculos no cenário para análise geométrica básica. | Could | Poderia (l.117) | Proposto | — |
