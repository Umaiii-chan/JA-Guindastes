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
| [ADR-001](ADR-001-workflow-baseado-em-arquivos.md) | Workflow de múltiplas IAs baseado em arquivos versionados, sem API | Aceito | 2026-09-05 |
| [ADR-002](ADR-002-modelo-de-branches-por-ambiente.md) | Modelo de branches por ambiente (development, homologation, production) | Aceito | 2026-09-05 |
| [ADR-003](ADR-003-orquestracao-local-via-clis-de-assinatura.md) | Orquestração local de agentes via CLIs de assinatura, sem API paga (substitui o ADR-001 se aceito) | Proposto | 2026-09-26 |
