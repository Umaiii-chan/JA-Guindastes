# Requisitos não funcionais

Transcrição literal da [documentação técnica v0.1](../produto/documentacao-tecnica-v0.1.md), § 5
(TASK-002, 2026-09-26). A coluna **Requisito** é cópia exata da doc-fonte.

- **Status:** todos `Proposto` até a pessoa responsável aprovar.
- **Critérios de aceite:** a doc-fonte não traz critérios por requisito. Eles são escritos no formato
  de [`README.md`](README.md) quando o requisito virar tarefa; até lá, a referência é a Definition of
  Done do MVP (doc-fonte § 24).
- **Prioridade:** a doc-fonte não atribui prioridade aos RNF.
- **Mensurabilidade:** vários RNF ainda não têm meta mensurável (ex.: RNF-003 diz "a ser medida no
  MVP"); as metas entram quando forem definidas.
- **Tarefas:** as que implementaram (total ou parcialmente) o requisito, tiradas do campo
  "Requisitos" de cada arquivo em `tasks/completed/` e, para a leva C (TASK-033..036, mesclada no
  PR #34), em `tasks/in-progress/` (TASK-037). Não
  entram a TASK-002 (registrou todos os requisitos) nem a TASK-009 (só o ADR-013). Uma tarefa listada
  **não** significa requisito atendido: o status continua decisão da pessoa responsável.

| ID | Requisito | Doc-fonte | Status | Tarefas |
|----|-----------|-----------|--------|---------|
| RNF-001 | O motor de cálculo deve possuir testes unitários independentes da API e do banco. | l.125 | Proposto | TASK-008, TASK-015, TASK-018, TASK-020 |
| RNF-002 | Regras de domínio não podem depender diretamente de FastAPI, SQLAlchemy, Three.js ou React. | l.126 | Proposto | TASK-004, TASK-008, TASK-010, TASK-011, TASK-013, TASK-014, TASK-015, TASK-016, TASK-020, TASK-022, TASK-028 |
| RNF-003 | O cálculo de uma alteração operacional deve responder rápido o suficiente para uso interativo; a meta inicial é retorno perceptualmente imediato em ambiente local, a ser medida no MVP. | l.127 | Proposto | TASK-016, TASK-025, TASK-032 (sem medição) |
| RNF-004 | Modelos 3D devem usar escala física consistente, preferencialmente metros como unidade interna. | l.128 | Proposto | TASK-008, TASK-014, TASK-026, TASK-028 |
| RNF-005 | Toda tabela de carga deve ter versão e origem rastreáveis. | l.129 | Proposto | TASK-022, TASK-031 |
| RNF-006 | Importações inválidas devem produzir relatório de inconsistências e não corromper dados válidos existentes. | l.130 | Proposto | TASK-010, TASK-019, TASK-022, TASK-023, TASK-031, TASK-034 |
| RNF-007 | O backend deve expor contrato OpenAPI e validar payloads. | l.131 | Proposto | TASK-004, TASK-019, TASK-024, TASK-029 |
| RNF-008 | O código deve possuir tipagem estática no frontend e type hints no backend. | l.132 | Proposto | TASK-004, TASK-007, TASK-008, TASK-010, TASK-014, TASK-032 |
| RNF-009 | A aplicação deve suportar navegadores desktop modernos com WebGL. | l.133 | Proposto | TASK-007 |
| RNF-010 | As regras de cálculo devem ser reproduzíveis com os mesmos dados de entrada e versão de tabela. | l.134 | Proposto | TASK-008, TASK-014, TASK-015, TASK-020 |
| RNF-011 | O projeto deve manter documentação técnica e diagramas versionados no repositório. | l.135 | Proposto | TASK-012, TASK-017 (e TASK-037, em andamento) |
| RNF-012 | O sistema deve permitir adicionar novos modelos/configurações sem alterar o núcleo do motor de cálculo. | l.136 | Proposto | — |
