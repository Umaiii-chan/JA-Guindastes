# Requisitos funcionais

Transcrição literal da [documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md), § 4
(TASK-002, 2026-09-26). A coluna **Requisito** é cópia exata da doc-fonte.

- **Status:** todos `Proposto` até a pessoa responsável aprovar.
- **Critérios de aceite:** a doc-fonte não traz critérios por requisito. Eles são escritos no formato
  de [`README.md`](README.md) quando o requisito virar tarefa; até lá, a referência é a Definition of
  Done do MVP (doc-fonte § 24).
- **Prioridade:** convertida para MoSCoW (Deve → Must, Deveria → Should, Poderia → Could); a
  coluna "Doc-fonte" mostra o termo original.

| ID | Requisito | Prioridade | Doc-fonte | Status | Tarefas |
|----|-----------|------------|-----------|--------|---------|
| RF-001 | Cadastrar fabricantes de guindastes. | Must | Deve (l.94) | Proposto | — |
| RF-002 | Cadastrar modelos de guindastes. | Must | Deve (l.95) | Proposto | — |
| RF-003 | Importar modelo 3D de um guindaste em formato interno GLB/glTF. | Must | Deve (l.96) | Proposto | — |
| RF-004 | Configurar escala, orientação e nós/articulações do modelo 3D. | Must | Deve (l.97) | Proposto | — |
| RF-005 | Cadastrar múltiplas configurações operacionais para um guindaste. | Must | Deve (l.98) | Proposto | — |
| RF-006 | Importar tabela de carga em CSV/XLSX. | Must | Deve (l.99) | Proposto | — |
| RF-007 | Vincular uma tabela de carga a uma configuração específica do guindaste. | Must | Deve (l.100) | Proposto | — |
| RF-008 | Preservar metadados e documento-fonte da tabela importada. | Must | Deve (l.101) | Proposto | — |
| RF-009 | Validar e normalizar unidades e pontos da tabela. | Must | Deve (l.102) | Proposto | — |
| RF-010 | Selecionar guindaste e configuração para uma nova simulação. | Must | Deve (l.103) | Proposto | — |
| RF-011 | Criar/configurar carga com peso e dimensões. | Must | Deve (l.104) | Proposto | — |
| RF-012 | Manipular giro da superestrutura/torre. | Must | Deve (l.105) | Proposto | — |
| RF-013 | Manipular inclinação e comprimento/extensão da lança. | Must | Deve (l.106) | Proposto | — |
| RF-014 | Manipular comprimento do cabo/posição do gancho. | Must | Deve (l.107) | Proposto | — |
| RF-015 | Calcular raio de trabalho e altura/posição do gancho em tempo de execução. | Must | Deve (l.108) | Proposto | — |
| RF-016 | Consultar ou interpolar a capacidade correspondente na tabela vinculada. | Must | Deve (l.109) | Proposto | — |
| RF-017 | Comparar carga informada com a capacidade calculada. | Must | Deve (l.110) | Proposto | — |
| RF-018 | Exibir capacidade, utilização, raio, comprimento de lança e status da operação. | Must | Deve (l.111) | Proposto | — |
| RF-019 | Emitir alertas em tempo real quando uma regra operacional for violada. | Must | Deve (l.112) | Proposto | — |
| RF-020 | Rejeitar ou sinalizar consulta fora do domínio suportado pela tabela. | Must | Deve (l.113) | Proposto | — |
| RF-021 | Salvar uma simulação e seu estado relevante. | Should | Deveria (l.114) | Proposto | — |
| RF-022 | Consultar simulações previamente salvas. | Should | Deveria (l.115) | Proposto | — |
| RF-023 | Exportar um resumo técnico da simulação. | Could | Poderia (l.116) | Proposto | — |
| RF-024 | Permitir cadastrar obstáculos no cenário para análise geométrica básica. | Could | Poderia (l.117) | Proposto | — |
