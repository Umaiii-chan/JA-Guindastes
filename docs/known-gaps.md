# Limitações conhecidas e dívidas técnicas

> Este documento existe para que **nenhum agente presuma que algo funciona quando não funciona**.
> Qualquer pessoa ou agente pode adicionar itens. Só a pessoa responsável remove (quando resolvido,
> mova para a seção "Resolvidos" com a tarefa que resolveu).

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 |

---

## 1. Limitações funcionais

Coisas que o sistema **não faz** hoje, mesmo que pareça que deveria.

| # | Limitação | Impacto | Decisão / plano | Tarefa |
|---|-----------|---------|-----------------|--------|
| L-001 | Não existe código: nenhuma funcionalidade do MVP está implementada | tudo o que está em `project-overview.md` § 4 é planejado | esqueletos do backend e do frontend nas próximas tarefas | — |
| L-002 | Ainda não há tabela de carga oficial nem modelo 3D real do guindaste | motor de cálculo, golden tests e demo não podem usar dados reais | depende da Guindastes Ribas (PEND-008; doc-fonte § 26, perguntas 1 a 5) | — |
| L-003 | Autenticação não definida ("autenticação futura", doc-fonte § 8.4) | qualquer usuário poderia importar e ativar tabelas, o que afeta a capacidade calculada | ver P-009 | — |

---

## 2. Dívidas técnicas

Atalhos tomados conscientemente que precisam ser pagos.

| # | Dívida | Onde | Por que foi feito assim | Risco de não resolver | Tarefa |
|---|--------|------|-------------------------|-----------------------|--------|
| — | nenhuma ainda (não há código) | — | — | — | — |

---

## 3. Problemas conhecidos (bugs)

| # | Problema | Como reproduzir | Contorno | Tarefa |
|---|----------|-----------------|----------|--------|
| — | nenhum ainda (não há código) | — | — | — |

---

## 4. Decisões pendentes

Perguntas sem resposta que bloqueiam ou influenciam trabalho futuro. A pessoa responsável decide e
o resultado vira ADR (arquitetural) ou RN (negócio). As PEND-001..008 da doc-fonte estão em
[`business-rules.md`](business-rules.md) → "Perguntas em aberto". Os itens abaixo são lacunas que a
doc-fonte v0.1 não cobre, levantadas na análise que originou a TASK-002 (achados não verificados
por revisor).

| # | Pergunta | Levantada por | Data | Bloqueia |
|---|----------|---------------|------|----------|
| P-001 | Convenções geométricas: sistema de coordenadas, unidade e zero dos ângulos, de onde se mede o raio de trabalho (eixo de giro? pino da lança?), referência da altura do gancho, offsets do pivô | agente (análise TASK-002) | 2026-09-26 | `GeometryService`, PoC Three.js, golden tests |
| P-002 | O que é "comprimento de lança" em lança telescópica, e como tratar comprimentos entre as colunas da tabela | agente (análise TASK-002) | 2026-09-26 | `LoadChartInterpolator` (junto com PEND-001) |
| P-003 | Onde o domínio guarda a geometria de cálculo do guindaste (ficha técnica cadastrada no backend, e não o GLB), para o backend ser fonte de verdade (RN-008) | agente (análise TASK-002) | 2026-09-26 | modelo de domínio, `GeometryService` |
| P-004 | Geometria calculada no frontend (`getOperationalGeometry`) e no backend: como evitar divergência | agente (análise TASK-002) | 2026-09-26 | integração frontend ↔ backend |
| P-005 | Status provisório dos alertas enquanto a PEND-004 não é respondida (os exemplos da doc-fonte já usam `WARNING`); se carga = capacidade é violação; se a carga comparada é bruta | agente (análise TASK-002) | 2026-09-26 | `SafetyValidator` |
| P-006 | Formato canônico interno de importação CSV/XLSX (colunas, unidades) enquanto a PEND-008 está aberta | agente (análise TASK-002) | 2026-09-26 | PoC de importação |
| P-007 | Dados de teste: usar dados fictícios, rotulados como tal, até a tabela oficial chegar? Os dados oficiais podem ir para o repositório e para agentes de IA? Qual tolerância nos golden tests? | agente (análise TASK-002) | 2026-09-26 | testes do motor de cálculo |
| P-008 | Requisitos de segurança dos uploads GLB/XLSX/CSV (tamanho máximo, zip bomb, macros, path traversal) | agente (análise TASK-002) | 2026-09-26 | importadores e storage |
| P-009 | Autenticação e autorização no MVP (quem pode importar e ativar tabelas), CORS e validação de Origin no WebSocket | agente (análise TASK-002) | 2026-09-26 | API e WebSocket |
| P-010 | Onde fica o orquestrador de agentes: `tools/orquestrador/` neste repositório ou repositório separado | pessoa (ADR-003) | 2026-09-26 | orquestrador |
| P-011 | O que `homologation` e `production` (ADR-002) significam num projeto acadêmico; haverá demo hospedada? | agente (análise TASK-002) | 2026-09-26 | CI/deploy |
| P-012 | Equipe: quantas pessoas trabalham no repositório, quem aprova PRs e regras de negócio, e qual a política do curso sobre uso de IA | agente (análise TASK-002) | 2026-09-26 | fluxo de revisão |
| P-013 | Existe versão da documentação mais nova que a v0.1 (13/08/2026), ou respostas da Estação 1 às PEND? | agente (análise TASK-002) | 2026-09-26 | toda a Camada 1 |

---

## 5. O que os agentes NÃO devem presumir

Lista explícita. Se está aqui, o agente deve **verificar** antes de depender.

- que existe código, pasta `frontend/`/`backend/`, dependência instalada ou comando funcionando: não existe (2026-09-26)
- que os números dos exemplos da doc-fonte (§§ 14.2, 14.3 e 15.4: raio 13,5 m, capacidade 5200 kg etc.) são capacidades reais ou casos de teste: são ilustrativos
- que existe regra de interpolação, arredondamento, nível de alerta ou extrapolação: estão pendentes (PEND-001..004, RN-007)
- que o modelo 3D define capacidade ou geometria de cálculo: não define (RN-003; P-003)
- que o formato das tabelas da empresa é conhecido: não é (PEND-008)
- que `codex` ou `gemini` estão instalados: em 2026-09-26 só o `claude` (Claude Code 2.1.280) estava no PATH (ADR-003)
- que os termos de uso das assinaturas permitem automação local via CLI: não confirmado para nenhum fornecedor (ADR-003, princípio (e))
- que `claude -p` consome a cota da assinatura, e não crédito de API, nem qual é o formato do JSON de saída: não verificado, `claude -p` nunca foi executado (ADR-003, "Evidências")

---

## 6. Áreas sem cobertura de testes

Cópia de [`testing-strategy.md`](testing-strategy.md) § 7 para ficar visível aqui.

- tudo: ainda não existe código nem teste (2026-09-26)

---

## 7. Resolvidos

Histórico do que saiu das seções acima.

| # | Item | Resolvido em | Tarefa / PR |
|---|------|--------------|-------------|
| — | — | — | — |
