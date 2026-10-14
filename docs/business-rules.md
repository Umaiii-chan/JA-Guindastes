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

### RN-011 — Limite de uso da capacidade por modelo

**Status:** Ativa
**Contexto:** avaliação operacional (TASK-051).
**Regra:** cada modelo de guindaste tem um limite de uso da capacidade, de 1 a 100 % (padrão 100). A capacidade efetiva é a capacidade da tabela × limite. Acima da capacidade efetiva, o status é "acima do limite". A partir de uma faixa de atenção configurável (padrão: 90 % do limite), o status é "atenção".
**Exemplos:**
- limite 85 %, capacidade da tabela 10 000 kg, peso comparado 8 000 kg → efetiva 8 500 kg; 94,1 % do limite → atenção
- mesmo caso com 9 000 kg → acima do limite
**Exceções:** nenhuma
**Testes relacionados:** —
**Origem:** Anderson Sehnem, em chat em 2026-10-14 (plano da leva E)

### RN-012 — Carga não atravessa terreno, guindaste nem obstáculos

**Status:** Ativa
**Contexto:** simulação 3D (TASK-053).
**Regra:** a carga suspensa e os acessórios não podem atravessar o terreno, o corpo do guindaste nem os obstáculos. O comando que causaria colisão deve ser bloqueado no último estado seguro e sinalizado.
**Exemplos:**
- baixar o cabo até a carga tocar o chão → o cabo para no contato e aparece o alerta de colisão
**Exceções:** nenhuma
**Testes relacionados:** —
**Origem:** Anderson Sehnem, em chat em 2026-10-14

### RN-013 — Risco de tombamento por regras

**Status:** Ativa
**Contexto:** avaliação operacional (TASK-055).
**Regra:** o risco de tombamento é **baixo**, **atenção** ou **alto**, com a lista de motivos. Não há cálculo físico de estabilidade. É alto com qualquer um destes:
- utilização acima do limite (RN-011);
- patolas não totalmente estendidas e apoiadas com carga suspensa;
- inclinação residual do terreno sob o guindaste acima do máximo do modelo;
- operação fora da tabela com carga.

É atenção com a utilização na faixa de atenção.
**Exemplos:**
- patolas a 50 % com carga → alto
**Exceções:** valores FICTÍCIOS até haver dado oficial
**Testes relacionados:** —
**Origem:** Anderson Sehnem, em chat em 2026-10-14

### RN-014 — Peso comparado inclui os acessórios de içamento

**Status:** Ativa
**Contexto:** avaliação operacional (TASK-056); estende o ADR-018.
**Regra:** o peso comparado com a capacidade é carga + moitão/gancho + acessórios de içamento. Jib e contrapeso não são acessórios: são configurações com tabela própria (RN-001, RN-002). Trocá-los troca a configuração.
**Exemplos:**
- carga 3 000 kg + gancho 200 kg + manilha 20 kg + cinta 15 kg → 3 235 kg comparados
**Exceções:** nenhuma
**Testes relacionados:** —
**Origem:** Anderson Sehnem, em chat em 2026-10-14

### RN-015 — O ambiente influencia a utilização e o risco de tombamento

**Status:** Ativa
**Contexto:** avaliação operacional (TASK-067).
**Regra:** todas as configurações de ambiente devem influenciar na carga de utilização e no risco de tombamento. A capacidade efetiva (RN-011) passa a ser capacidade da tabela × limite do modelo × fator de inclinação × fator de vento.
- Inclinação: acima da máxima do modelo, risco alto e status "acima do limite". Abaixo dela, a capacidade cai uma % configurável por grau de inclinação residual (padrão 10 %).
- Solo sob as quatro sapatas (rocha, compactado, argila, aterro solto): a pressão na pior sapata (massa do guindaste + peso comparado, × 0,5, ÷ área da sapata) acima do suporte do solo é risco alto; acima de 80 % do suporte, atenção.
- Vento: até 9,8 m/s sem efeito; de 9,8 a 13,8 m/s a capacidade cai linearmente até 50 % e o risco é atenção; acima de 13,8 m/s a operação é bloqueada (risco alto, "acima do limite").
- Obstáculos no raio de giro: risco atenção, com o alerta dos ids.

Entradas de solo, vento e obstáculos são opcionais: ausentes, não têm efeito e não geram alerta.
**Exemplos:**
- vento de 11,8 m/s → capacidade efetiva a 75 % da capacidade sem vento
- sapatas de 0,5 m², guindaste de 36 000 kg, carga comparada de 4 000 kg → 392 kPa: não cabe em argila (150 kPa), cabe em rocha (1 000 kPa)
**Exceções:** valores numéricos FICTÍCIOS até haver dado oficial
**Testes relacionados:** `backend/tests/domain/test_environment_factors.py`
**Origem:** Anderson Sehnem, em chat em 2026-10-14

### RN-016 — Içamento com dois guindastes (tandem)

**Status:** Ativa
**Contexto:** avaliação operacional (TASK-074; ADR-037); estende RN-011, RN-014 e RN-015.
**Regra:** uma carga pode ser içada por dois guindastes, que se movem sincronizados. Cada guindaste usa no máximo 75 % da própria capacidade: a capacidade efetiva (RN-011, RN-015) × 0,75. A carga se divide pela posição dos pontos de içamento em relação ao centro de gravidade (alavanca): o peso de cada guindaste é o peso da carga × a distância do outro ponto ao centro de gravidade ÷ a distância entre os pontos. Cada guindaste é avaliado com a parte dele mais o gancho e os acessórios (RN-014). O içamento só é permitido quando os dois são avaliáveis, nenhum passa de 75 % e nenhum tem risco de tombamento alto.
**Exemplos:**
- carga de 10 000 kg com o centro de gravidade no meio entre os pontos → 5 000 kg para cada
- centro de gravidade a 1 m de um ponto e a 3 m do outro → o ponto mais perto leva 7 500 kg e o outro 2 500 kg
- capacidade efetiva de 4 000 kg → no tandem esse guindaste usa até 3 000 kg (parte da carga + gancho)
**Exceções:** com o centro de gravidade fora do trecho entre os dois pontos a alavanca não fecha (um guindaste teria de puxar para baixo): o içamento não é permitido, e o aviso diz isso. O fator 0,75 vem da pessoa responsável, que o citou como regra de norma; não há tabela oficial no repositório.
**Testes relacionados:** `backend/tests/domain/test_tandem_load_split.py`, `backend/tests/presentation/test_evaluations_tandem.py`, `frontend/tests/domain/tandem/tandem.test.ts`
**Origem:** Anderson Sehnem, em chat em 2026-10-14

---

## Regras por domínio (índice)

| Área | Regras |
|------|--------|
| Tabelas de carga e configuração | RN-001, RN-002, RN-004, RN-005, RN-007 |
| Modelo 3D | RN-003 |
| Unidades | RN-006 |
| Validação frontend ↔ backend | RN-008 |
| Içamento com dois guindastes | RN-016 |

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
