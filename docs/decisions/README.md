# Decisões arquiteturais (ADRs)

Um **ADR** (*Architecture Decision Record*) registra uma decisão relevante, o contexto em que foi
tomada, as alternativas consideradas e as consequências. Serve para que ninguém — pessoa ou IA —
reabra uma discussão já encerrada sem saber por que ela foi encerrada daquele jeito.

## Quando criar um ADR

Crie um ADR quando a decisão:

- afeta a estrutura do sistema (camadas, componentes, fronteiras);
- introduz, remove ou troca uma tecnologia, biblioteca relevante ou serviço externo;
- define um padrão que outras partes do código vão seguir;
- é difícil ou cara de reverter;
- foi objeto de dúvida e alguém precisou decidir.

**Não** crie ADR para escolhas locais e reversíveis (nome de variável, ordem de métodos).

## Quem pode criar

- **Pessoas:** criam com status `Aceito` diretamente.
- **Agentes de IA:** criam com status `Proposto` e registram no handoff. A pessoa responsável muda
  para `Aceito` ou `Rejeitado`. Um agente **nunca** implementa uma decisão `Proposta` por conta própria.

## Regras

- Numeração sequencial: `ADR-001`, `ADR-002`... Nunca reutilizar.
- Nome do arquivo: `ADR-NNN-slug-curto.md`.
- ADR `Aceito` é **imutável**. Para mudar, crie um novo ADR preenchendo o campo **Substitui** com
  `ADR-NNN` e mude o status do antigo para `Substituído por ADR-MMM`.
- Todo ADR aceito deve refletir em [`../architecture.md`](../architecture.md) § 8.

## Template

[`ADR-000-template.md`](ADR-000-template.md)

## Índice

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [ADR-001](ADR-001-workflow-baseado-em-arquivos.md) | Workflow de múltiplas IAs baseado em arquivos versionados, sem API | Substituído por ADR-003 | 2026-09-05 |
| [ADR-002](ADR-002-modelo-de-branches-por-ambiente.md) | Modelo de branches por ambiente (development, homologation, production) | Aceito | 2026-09-05 |
| [ADR-003](ADR-003-orquestracao-local-via-clis-de-assinatura.md) | Orquestração local de agentes via CLIs de assinatura, sem API paga (substitui o ADR-001) | Aceito | 2026-09-26 |
| [ADR-004](ADR-004-clean-architecture-no-backend.md) | Clean Architecture (doc-fonte v0.1 § 7) | Aceito | 2026-09-26 |
| [ADR-005](ADR-005-frontend-react-typescript-threejs.md) | Frontend React + TypeScript + Three.js (doc-fonte v0.1 § 7) | Aceito | 2026-09-26 |
| [ADR-006](ADR-006-backend-fastapi-python.md) | Backend FastAPI + Python (doc-fonte v0.1 § 7) | Aceito | 2026-09-26 |
| [ADR-007](ADR-007-postgresql.md) | PostgreSQL (doc-fonte v0.1 § 7) | Aceito | 2026-09-26 |
| [ADR-008](ADR-008-glb-gltf-como-formato-3d-interno.md) | GLB/glTF como formato 3D interno (doc-fonte v0.1 § 7) | Aceito | 2026-09-26 |
| [ADR-009](ADR-009-tabelas-de-carga-estruturadas-no-banco.md) | Tabelas estruturadas no banco (doc-fonte v0.1 § 7) | Aceito | 2026-09-26 |
| [ADR-010](ADR-010-rest-e-websocket.md) | REST + WebSocket (doc-fonte v0.1 § 7) | Aceito | 2026-09-26 |
| [ADR-011](ADR-011-monorepo.md) | Monorepo (doc-fonte v0.1 § 7) | Aceito | 2026-09-26 |
| [ADR-012](ADR-012-toolchain-de-desenvolvimento.md) | Toolchain de desenvolvimento do backend e do frontend | Aceito | 2026-09-26 |
| [ADR-013](ADR-013-convencoes-geometricas-provisorias.md) | Convenções geométricas provisórias: coordenadas, ângulos, referência do raio, parâmetros do guindaste e fórmulas | Aceito | 2026-09-26 |
| [ADR-014](ADR-014-orm-e-driver-postgresql.md) | SQLAlchemy 2 como ORM e psycopg 3 como driver do PostgreSQL | Proposto | 2026-09-26 |
| [ADR-015](ADR-015-consulta-conservadora-provisoria.md) | Consulta conservadora provisória entre pontos da tabela de carga | Aceito (provisório) | 2026-09-26 |
| [ADR-016](ADR-016-autenticacao-e-perfis.md) | Autenticação por sessão em cookie e perfis Admin/Operador | Aceito | 2026-09-26 |
| [ADR-017](ADR-017-navegacao-e-design-system-do-frontend.md) | Navegação por páginas e design system escuro do frontend | Aceito | 2026-09-26 |
| [ADR-018](ADR-018-zonas-de-giro-e-peso-do-gancho.md) | Tabelas por zona de giro e peso do gancho na comparação | Aceito | 2026-09-27 |
| [ADR-019](ADR-019-visual-manual-tecnico.md) | Linguagem visual de manual técnico (substitui o tema escuro do ADR-017 §§ 3–4) | Aceito | 2026-09-27 |
| [ADR-020](ADR-020-deploy-render-vercel.md) | Render para dados e API; Vercel para o frontend | Substituído por ADR-021 quanto ao plano | 2026-09-30 |
| [ADR-021](ADR-021-plano-gratuito-render.md) | Plano gratuito do Render para a apresentação | Aceito | 2026-09-30 |
| [ADR-022](ADR-022-limite-de-capacidade-por-modelo.md) | Limite de uso da capacidade por modelo | Aceito | 2026-10-14 |
| [ADR-023](ADR-023-cenarios-com-terreno-editavel.md) | Cenários com terreno editável e obstáculos | Aceito | 2026-10-14 |
| [ADR-024](ADR-024-patolas-animadas.md) | Patolas animadas | Aceito | 2026-10-14 |
| [ADR-025](ADR-025-risco-de-tombamento-e-area-de-operacao.md) | Risco de tombamento e área de operação | Aceito | 2026-10-14 |
| [ADR-026](ADR-026-acessorios-de-icamento.md) | Acessórios de içamento | Aceito | 2026-10-14 |
| [ADR-027](ADR-027-gravacao-e-reproducao-de-simulacoes.md) | Gravação e reprodução de simulações | Aceito | 2026-10-14 |
| [ADR-028](ADR-028-colisoes-da-carga.md) | Colisões da carga | Aceito | 2026-10-14 |
| [ADR-029](ADR-029-lanca-entre-colunas-proxima-mais-longa.md) | Lança entre colunas: próxima mais longa | Aceito | 2026-10-14 |
| [ADR-030](ADR-030-interpolacao-linear-provisoria.md) | Interpolação linear provisória | Substituído em parte por ADR-043 (comprimento de lança) | 2026-10-14 |
| [ADR-032](ADR-032-editor-3d-do-ambiente.md) | Editor 3D livre do ambiente | Aceito | 2026-10-14 |
| [ADR-031](ADR-031-modelo-3d-guindaste-80t.md) | Troca do modelo 3D do guindaste (80 t, CC BY 4.0) | Substituído em parte por ADR-034 | 2026-10-14 |
| [ADR-034](ADR-034-eixo-de-giro-real-do-modelo-80t.md) | Eixo de giro real do modelo 80 t (a = 0,46 m) | Aceito | 2026-10-14 |
| [ADR-035](ADR-035-carga-posicionavel-entrega-engatar-e-soltar.md) | Carga posicionável, ponto de entrega, engatar e soltar | Aceito | 2026-10-14 |
| [ADR-036](ADR-036-biblioteca-de-objetos-reais.md) | Biblioteca de objetos reais no editor 3D | Aceito | 2026-10-14 |
| [ADR-037](ADR-037-tandem-dois-guindastes.md) | Içamento com dois guindastes (tandem) | Aceito | 2026-10-14 |
| [ADR-038](ADR-038-planejamento-da-operacao.md) | Planejamento da operação: guindaste, posição e trajetória | Aceito | 2026-10-14 |
| [ADR-039](ADR-039-assistente-de-ia-gemini.md) | Assistente de IA (Gemini): cenário por texto, explicação, relatório e revisão | Aceito | 2026-10-14 |
| [ADR-040](ADR-040-provedor-openai-com-reserva.md) | Provedor OpenAI para a IA, com reserva entre provedores | Aceito | 2026-10-14 |
| [ADR-041](ADR-041-pontos-de-icamento-do-tandem.md) | Pontos de içamento do tandem a 1/4 e 3/4 do comprimento (substitui a frase dos 40 % do ADR-038) | Aceito | 2026-10-16 |
| [ADR-042](ADR-042-conferencia-continua-do-plano.md) | Conferência contínua do plano: giro denso, lança, cabo, coleta e entrega | Aceito | 2026-10-16 |
| [ADR-043](ADR-043-lanca-entre-colunas-na-interpolacao.md) | Lança entre colunas na interpolação: próxima mais longa | Aceito | 2026-10-16 |
