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
