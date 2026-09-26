# Regras de negócio

> **Este é o documento que os agentes menos podem inventar.**
> Regras funcionais só entram aqui por decisão da pessoa responsável. Um agente que encontrar uma
> situação não coberta por este documento **deve perguntar** (registrando em
> `handoffs/current.md` → "Pendências / decisões necessárias"), nunca deduzir.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-09-26 |
| Aprovado por | Anderson Sehnem (transcrição da doc-fonte autorizada em 2026-09-26, TASK-002) |

---

## Como escrever uma regra

Cada regra tem um ID estável (`RN-001`, `RN-002`...) que pode ser citado em tarefas, testes, commits
e ADRs. **Nunca reutilize um ID.** Regra removida fica marcada como `Revogada`, não apagada.

Formato:

```markdown
### RN-001 — <título curto>

**Status:** Ativa | Revogada (em <data>, motivo)
**Contexto:** onde/quando a regra se aplica
**Regra:** enunciado preciso, sem ambiguidade. Prefira "deve"/"não deve".
**Exemplos:**
  - Entrada X → resultado Y
  - Entrada Z → erro W
**Exceções:** casos em que a regra não vale (ou "nenhuma")
**Testes relacionados:** `tests/...` (preenchido pelo agente ao criar o teste)
**Origem:** quem definiu / documento de referência
```

---

## Regras

As regras abaixo foram transcritas da [documentação técnica v0.1](produto/documentacao-tecnica-v0.1.md),
§ 6.1 ("Regras consolidadas"). O campo **Regra** é cópia literal da doc-fonte. Os títulos são só
rótulos de navegação. A doc-fonte não traz exemplos nem exceções: onde eles dependem da empresa
parceira, o campo diz **PENDENTE** e aponta a pergunta em aberto correspondente.

### RN-001 — Tabela de carga pertence à configuração

**Status:** Ativa
**Contexto:** cadastro e seleção de tabelas de carga.
**Regra:** uma **LoadChart** pertence a uma **CraneConfiguration**, não apenas ao modelo genérico do guindaste;
**Exemplos:**
- PENDENTE (quais atributos da configuração selecionam a tabela: pergunta 5)
**Exceções:** PENDENTE
**Testes relacionados:** —
**Origem:** doc-fonte v0.1 § 6.1 (l.144)

### RN-002 — O que a configuração representa

**Status:** Ativa
**Contexto:** cadastro de configurações operacionais.
**Regra:** a configuração deve representar, quando aplicável, informações como lança, jib, contrapeso, estabilizadores e demais condições que alterem a tabela;
**Exemplos:**
- PENDENTE (perguntas 5, 6 e 7)
**Exceções:** PENDENTE
**Testes relacionados:** —
**Origem:** doc-fonte v0.1 § 6.1 (l.145)

### RN-003 — O modelo 3D não define capacidade

**Status:** Ativa
**Contexto:** importação e uso de modelos GLB/glTF.
**Regra:** o arquivo 3D não define capacidade; ele fornece representação e cinemática;
**Exemplos:**
- PENDENTE
**Exceções:** nenhuma declarada na doc-fonte
**Testes relacionados:** —
**Origem:** doc-fonte v0.1 § 6.1 (l.146)

### RN-004 — Capacidade só da tabela/regra oficial

**Status:** Ativa
**Contexto:** cálculo de capacidade admissível.
**Regra:** a capacidade admissível sempre deve resultar da tabela/regra oficial vinculada à configuração selecionada;
**Exemplos:**
- PENDENTE (método de consulta/interpolação: pergunta 1)
**Exceções:** nenhuma declarada na doc-fonte
**Testes relacionados:** —
**Origem:** doc-fonte v0.1 § 6.1 (l.147)

### RN-005 — Registrar a versão da tabela usada

**Status:** Ativa
**Contexto:** todo cálculo de capacidade.
**Regra:** cada cálculo deve registrar a versão da tabela usada;
**Exemplos:**
- PENDENTE
**Exceções:** nenhuma declarada na doc-fonte
**Testes relacionados:** —
**Origem:** doc-fonte v0.1 § 6.1 (l.148)

### RN-006 — Unidades internas consistentes

**Status:** Ativa
**Contexto:** entradas, importação de tabelas e saídas do motor de cálculo.
**Regra:** valores de entrada e saída devem ser normalizados em unidades internas consistentes;
**Exemplos:**
- PENDENTE (unidades usadas nas tabelas da empresa: doc-fonte § 26, pergunta 10)
**Exceções:** nenhuma declarada na doc-fonte
**Testes relacionados:** —
**Origem:** doc-fonte v0.1 § 6.1 (l.149)

### RN-007 — Consultas fora da tabela identificadas explicitamente

**Status:** Ativa
**Contexto:** consulta/interpolação da tabela de carga.
**Regra:** consultas fora dos limites conhecidos da tabela devem ser identificadas explicitamente;
**Exemplos:**
- PENDENTE (se alguma extrapolação é permitida e qual mensagem mostrar: doc-fonte § 26, pergunta 9)
**Exceções:** PENDENTE
**Testes relacionados:** —
**Origem:** doc-fonte v0.1 § 6.1 (l.150)

### RN-008 — O frontend não é fonte de verdade da capacidade

**Status:** Ativa
**Contexto:** avaliação operacional em tempo real (frontend ↔ backend).
**Regra:** o estado visual do frontend não é fonte de verdade para a regra de capacidade; o backend deve validar os dados operacionais recebidos.
**Exemplos:**
- PENDENTE
**Exceções:** nenhuma declarada na doc-fonte
**Testes relacionados:** —
**Origem:** doc-fonte v0.1 § 6.1 (l.151)

---

## Regras por domínio (índice)

| Área | Regras |
|------|--------|
| Tabelas de carga e configuração | RN-001, RN-002, RN-004, RN-005, RN-007 |
| Modelo 3D | RN-003 |
| Unidades | RN-006 |
| Validação frontend ↔ backend | RN-008 |

---

## Perguntas em aberto

Transcritas da doc-fonte § 6.2 ("Pontos pendentes de validação com a empresa"), com o texto literal.
A pessoa responsável transforma cada item em uma RN ou descarta, depois de validar com a Guindastes
Ribas. As perguntas completas para a empresa estão na doc-fonte § 26.

| # | Situação | Levantada por | Data | Decisão |
|---|----------|---------------|------|---------|
| 1 | PEND-001: método exato de interpolação permitido para cada tabela/fabricante; | doc-fonte v0.1 § 6.2 (l.155) | 2026-08-13 | pendente |
| 2 | PEND-002: política de arredondamento; | doc-fonte v0.1 § 6.2 (l.156) | 2026-08-13 | pendente |
| 3 | PEND-003: se determinados campos devem utilizar valor mais conservador em vez de interpolação; | doc-fonte v0.1 § 6.2 (l.157) | 2026-08-13 | pendente |
| 4 | PEND-004: limites e níveis dos alertas (normal, atenção, crítico); | doc-fonte v0.1 § 6.2 (l.158) | 2026-08-13 | pendente |
| 5 | PEND-005: quais configurações físicas precisam obrigatoriamente participar da seleção da tabela; | doc-fonte v0.1 § 6.2 (l.159) | 2026-08-13 | pendente |
| 6 | PEND-006: tratamento de acessórios, moitões, cabos e pesos auxiliares; | doc-fonte v0.1 § 6.2 (l.160) | 2026-08-13 | pendente |
| 7 | PEND-007: necessidade de considerar setores de giro diferentes; | doc-fonte v0.1 § 6.2 (l.161) | 2026-08-13 | pendente |
| 8 | PEND-008: formato real das tabelas que a empresa irá fornecer. | doc-fonte v0.1 § 6.2 (l.162) | 2026-08-13 | pendente |
