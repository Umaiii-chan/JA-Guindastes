# Regras de negócio

> **Este é o documento que os agentes menos podem inventar.**
> Regras funcionais só entram aqui por decisão da pessoa responsável. Um agente que encontrar uma
> situação não coberta por este documento **deve perguntar** (registrando em
> `handoffs/current.md` → "Pendências / decisões necessárias"), nunca deduzir.

| Campo | Valor |
|-------|-------|
| Última revisão | 2026-10-18 |
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

**Status:** Substituída pela RN-017 (TASK-106; ADR-050), no que toca ao tombamento e à inclinação residual; os limites duros (patolas totalmente estendidas, inclinação máxima, fora da tabela) continuam valendo
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

**Status:** Substituída pela RN-017 (TASK-106; ADR-050): os fatores de inclinação e de vento, a rampa do vento e o 0,5 do peso por sapata saíram; os obstáculos no raio de giro continuam
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
**Contexto:** avaliação operacional (TASK-074; ADR-037); estende RN-011, RN-014 e RN-017 (a RN-015 foi substituída por ela).
**Regra:** uma carga pode ser içada por dois guindastes, que se movem sincronizados. Cada guindaste usa no máximo 75 % da própria capacidade: a capacidade efetiva (RN-011) × 0,75. A carga se divide pela posição dos pontos de içamento em relação ao centro de gravidade (alavanca): o peso de cada guindaste é o peso da carga × a distância do outro ponto ao centro de gravidade ÷ a distância entre os pontos. Cada guindaste é avaliado com a parte dele mais o gancho e os acessórios (RN-014). O içamento só é permitido quando os dois são avaliáveis, nenhum passa de 75 % e nenhum tem risco de tombamento alto.
**Exemplos:**
- carga de 10 000 kg com o centro de gravidade no meio entre os pontos → 5 000 kg para cada
- centro de gravidade a 1 m de um ponto e a 3 m do outro → o ponto mais perto leva 7 500 kg e o outro 2 500 kg
- capacidade efetiva de 4 000 kg → no tandem esse guindaste usa até 3 000 kg (parte da carga + gancho)
**Exceções:** com o centro de gravidade fora do trecho entre os dois pontos a alavanca não fecha (um guindaste teria de puxar para baixo): o içamento não é permitido, e o aviso diz isso. O fator 0,75 vem da pessoa responsável, que o citou como regra de norma; não há tabela oficial no repositório.
**Testes relacionados:** `backend/tests/domain/test_tandem_load_split.py`, `backend/tests/presentation/test_evaluations_tandem.py`, `frontend/tests/domain/tandem/tandem.test.ts`
**Origem:** Anderson Sehnem, em chat em 2026-10-14

### RN-017 — Estabilidade por física (momentos no polígono das patolas), vento e inclinação residual

**Status:** Ativa
**Contexto:** avaliação operacional (TASK-106; ADR-050). Decisão D1 do Anderson Sehnem (2026-10-16): trocar as regras RN-013 e RN-015 por física, o mais próximo do real possível. **Substitui** o cálculo de tombamento da RN-013 e os fatores de inclinação, vento e solo da RN-015; as duas continuam documentadas acima, marcadas como substituídas.
**Regra:** a estabilidade vem da estática do plano de apoio, não de percentuais fixos.
- **Polígono de apoio:** o retângulo das quatro sapatas (fl, fr, rl, rr). A meia largura vai de 1,2 m (vigas recolhidas) a 3,8 m (100 %), interpolada pela extensão das vigas (ausente = 100 %); as sapatas dianteiras ficam a +3 m e as traseiras a −3 m do eixo de giro.
- **Tombamento:** para cada lado do polígono, `ρ = momento de tombamento ÷ momento estabilizante`. Estabilizam o chassi com as patolas (55 % da massa, sobre o eixo), a torre com o contrapeso (30 %, 2 m atrás do eixo, gira com ψ) e a lança (15 %, no meio entre o pino e a ponta). Tomba a carga comparada (RN-014) **dividida por 0,85**, no gancho, deslocada para fora pela flecha da lança (`Δ = 8·10⁻⁷ · Q[t] · L³`; só na estática, a consulta à tabela segue com o raio geométrico, RN-004), mais o vento e a inclinação. Com a carga sem vento nem inclinação, `ρ = 1` é exatamente "a carga comparada é 85 % da carga de tombamento sobre patolas". O risco é **alto** com `ρ ≥ 1` ou com as sapatas sem apoio, e **atenção** de `ρ` ≥ 90 %.
- **Reação em cada sapata:** plataforma rígida de quatro apoios sob os pesos verticais; se uma sapata descarrega, as três restantes resolvem o equilíbrio; se duas descarregam, o guindaste tombou. A pressão de cada sapata é a SUA reação ÷ a área da sapata, comparada com o solo sob ela: acima do suporte, risco alto; acima de 80 %, atenção.
- **Vento (EN 13000):** a velocidade informada é a rajada de 3 s no ponto mais alto. A velocidade máxima é a da tabela (9 m/s, FICTÍCIA) até `A_W / m_H = 1,2 m²/t`; acima disso, `v_max = v_tab · √(1,2 ÷ (A_W / m_H))`, com `A_W` a área de vento da carga (área projetada × coeficiente de arrasto) e `m_H` o peso comparado em toneladas. Acima de `v_max`, a operação é bloqueada (risco alto); de 90 % a 100 % de `v_max`, atenção. O vento também soma ao momento de tombamento (carga e lança, no pior sentido para todo lado).
- **Inclinação residual α:** desloca cada peso na altura `h` de `h · sen α` para fora da linha, e soma `sen α · (Σ peso × altura do CG + carga ÷ 0,85 × altura do gancho)` ao momento de tombamento, no pior sentido para todo lado. Acima da inclinação máxima do modelo a tabela não vale: risco alto e "acima do limite" (limite duro, mantido da RN-013).
- **Mantidos da RN-013:** utilização acima do limite (RN-011), patolas não totalmente estendidas e apoiadas com carga suspensa e operação fora da tabela com carga continuam risco alto.
- **Obstáculos no raio de giro** (RN-015): risco atenção, com o alerta dos ids.

A capacidade efetiva (RN-011) deixa de ter fator de inclinação e de vento (os campos `slope_factor` e `wind_factor` continuam no contrato, sempre 1). Entradas de solo, vento e obstáculos continuam opcionais: ausentes, não têm efeito e não geram alerta.
**Exemplos:**
- lança de 20 m, pino a 1 m do eixo, gancho a 11 m à frente (ψ = 0), carga comparada de 4 000 kg, vigas a 100 %: momento estabilizante 19 800·3 + 10 800·5 + 5 400·(3 − 6) = 97 200 kgf·m; momento de tombamento (4 000 ÷ 0,85) · (11 + 0,0256 − 3) = 37 767 kgf·m; `ρ` = 38,9 % no lado dianteiro; as sapatas dianteiras recebem 14 575 kgf cada e as traseiras 5 425 kgf (36 % do peso total na pior sapata, e não 50 %)
- a mesma carga com a lança sobre a diagonal (ψ = 45°): `ρ` cai para cerca de 22 %
- carga de 65 t com 280 m² de área de vento e tabela de 11,2 m/s: `v_max = 11,2 · √(1,2 ÷ 4,31) = 5,9 m/s` (exemplo da auditoria de 2026-10-16)
**Exceções:** TODOS os valores numéricos são FICTÍCIOS (polígono, massas, alturas dos CG, flecha, fator 0,85, velocidade da tabela, área de vento da lança) até a ficha oficial de estabilidade de cada modelo (pendência D5 da auditoria). O fator de carga de tombamento e as cláusulas citadas (ISO 4305, EN 13000, ASME B30.5) precisam ser conferidos nas normas vigentes, incluindo a numeração brasileira equivalente: não foram verificados no repositório.
**Testes relacionados:** `backend/tests/domain/test_stability.py`, `backend/tests/domain/test_environment_factors.py`, `backend/tests/presentation/test_evaluations.py`, `frontend/tests/infrastructure/api/evaluationStability.test.ts`
**Origem:** decisão D1 do Anderson Sehnem, em chat em 2026-10-16 (auditoria da física)

### RN-018 — Distância mínima de rede elétrica aérea

**Status:** Ativa
**Contexto:** avaliação operacional e planejamento (TASK-107; ADR-051). Decisão D4 do Anderson Sehnem, delegada ao agente ("decida por mim, quanto mais real melhor"), em 2026-10-17.
**Regra:** o cenário pode ter trechos de rede elétrica aérea (`power_lines`: trecho reto horizontal, altura de 0,5 a 200 m, tensão de 0 exclusive a 1000 kV, até 20 trechos). A **tensão é entrada do ambiente**. A distância mínima entre a rede e qualquer parte do guindaste ou da carga é a **Tabela A da OSHA 29 CFR 1926.1408**: até 50 kV, 10 pés (3,05 m); acima de 50 até 200 kV, 15 pés (4,57 m); acima de 200 até 350 kV, 20 pés (6,10 m); acima de 350 até 500 kV, 25 pés (7,62 m); acima de 500 até 750 kV, 35 pés (10,67 m); acima de 750 até 1000 kV, 45 pés (13,72 m). O limite da faixa pertence a ela. Tensão fora de 0–1000 kV é recusada.
- **Conferência:** distância 3D mínima entre o trecho e a lança (do pino à ponta), o cabo de aço (da ponta ao gancho) e a carga pendurada (cilindro com a meia-diagonal da pegada; no tandem, o canto mais afastado da metade içada), **na posição atual e com o giro varrido de 0° a 360°**, de 1° em 1°.
- **Resultado:** abaixo da mínima, alerta **crítico** (`POWER_LINE_CLEARANCE_VIOLATION`, ou `POWER_LINE_SWEPT_VIOLATION` se só a varredura do giro viola); abaixo de 1,5 × a mínima, **atenção**.
- **Planejamento:** cada trecho é um obstáculo elevado, com a caixa crescida da distância mínima em todas as direções; o plano nunca leva lança, cabo ou carga abaixo da mínima.
- **Sem `power_lines`** (ou sem o `site` da avaliação), não há conferência nem alerta. Os alertas de rede **não mudam** o `tipping_risk`.
**Exemplos:**
- 13,8 kV e 33 kV: mínima de 3,05 m; 138 kV: 4,57 m (e não 3,94 m, como dava a fórmula antiga "10 pés + 0,4 pol por kV", trocada pela Tabela A)
- a ponta da lança a 2,25 m de um trecho de 13,8 kV → alerta crítico; a 4,0 m → atenção (abaixo de 1,5 × 3,05 = 4,57 m); a 5,0 m → sem alerta
- a ponta a 5,0 m na posição atual, mas a 2,5 m quando o giro passa por 40° → `POWER_LINE_SWEPT_VIOLATION`
**Exceções:** a NR-10 e a NR-11 são o contexto normativo brasileiro, mas não trazem tabela própria de distância para guindaste; ficam citadas no plano de içamento exigido (RN-019). A rede é um trecho reto horizontal e o terreno sob ela vale y = 0 na avaliação. A Tabela A foi conferida no osha.gov pela implementação; a equivalência com a norma brasileira não foi verificada.
**Testes relacionados:** `backend/tests/domain/services/test_power_line.py`, `backend/tests/fixtures/power_line_clearance_cases.json`, `backend/tests/domain/services/planning/test_planner.py`, `frontend/tests/domain/environment/powerLine.test.ts`
**Origem:** decisão D4 do Anderson Sehnem, em chat em 2026-10-17 (delegada ao agente; a tabela inicial estava errada e foi trocada pela Tabela A)

### RN-019 — Içamento crítico

**Status:** Ativa
**Contexto:** avaliação operacional (TASK-107; ADR-051). Decisão D4 do Anderson Sehnem, delegada ao agente, em 2026-10-17.
**Regra:** o içamento é **crítico** quando **qualquer** destes gatilhos vale:
- carga comparada (RN-014) **≥ 75 %** da capacidade efetiva (RN-011);
- içamento em tandem (RN-016);
- carga sobre pessoas ou estruturas ocupadas (informado pelo usuário);
- distância à rede elétrica abaixo de **1,5 ×** a mínima (RN-018), inclusive na varredura do giro;
- vento acima de **70 %** da velocidade máxima de rajada da carga (`wind_limit_ms`, RN-017);
- solo sob as sapatas em atenção, ou inclinação residual a **70 %** ou mais do máximo do modelo.

Içamento crítico **não é proibido**: gera o alerta `CRITICAL_LIFT` (severidade **atenção**) com **a razão de cada gatilho e o plano de içamento exigido**: responsável técnico, memória de cálculo, supervisor e sinaleiro, análise de risco e permissão de trabalho, mais itens por gatilho (rede e NR-10, tandem, evacuação, vento, solo). O alerta não muda o `tipping_risk` e só aparece quando a avaliação recebe o `site`.
**Exemplos:**
- carga comparada de 3 000 kg com capacidade efetiva de 4 000 kg (75 %) → crítico, razão "carga a 75 % da capacidade"
- carga de 2 000 kg com capacidade de 4 000 kg (50 %), sem rede, sem vento, em solo bom → não é crítico
- tandem com cada guindaste a 60 % → crítico (tandem), com o plano exigido
**Exceções:** os limiares de 75 %, 70 % e 70 % são decisão do agente, delegada pelo Anderson, e não vêm de norma conferida; o plano exigido é uma lista de itens, não um documento. O cálculo depende da capacidade efetiva e do vento de RN-011 e RN-017, cujos valores numéricos são FICTÍCIOS até haver dado oficial (D5).
**Testes relacionados:** `backend/tests/domain/services/test_power_line.py`, `backend/tests/application/test_evaluate_operation_site.py`, `backend/tests/presentation/test_evaluations.py`, `frontend/tests/presentation/panels/PowerLinePanels.test.ts`
**Origem:** decisão D4 do Anderson Sehnem, em chat em 2026-10-17 (delegada ao agente)

### RN-020 — Altura das lingas: uma só geometria

**Status:** Ativa
**Contexto:** planejamento, engate e cena (TASK-107; ADR-051). Decisão F-19 do Anderson Sehnem, delegada ao agente, em 2026-10-17. Substitui as quatro definições anteriores da altura das lingas (planejador, cena do guindaste único, tandem com 1,5 m fixos e folga medida no engate).
**Regra:** a altura entre o gancho (ou a cadeia de acessórios, RN-014) e o topo da carga vem da **geometria real de amarração em ponte**, a mesma no planejador, na avaliação e na cena: `r` é a meia-diagonal da pegada da carga (no tandem, da metade que cada guindaste ergue); `α` é o ângulo da linga com a **horizontal**; o comprimento da linga é `L = r ÷ cos α` e a **queda** é `r · tan α`, com piso de 0,3 m.
- **Ângulo padrão:** α = 60°; se a linga passar de 8 m, 45°; se ainda passar, 45° e o aparelho real pediria balancim (`needs_spreader`).
- **Ângulo informado:** de 30° (ASME B30.9) a 85°; fora disso, 422.
- **Planejador:** o gancho de coleta do plano fica a `queda` acima do topo da carga, e o plano devolve `sling_length_m`, `sling_angle_deg` e `sling_drop_m` por guindaste.
- **Engate na cena:** vale com o fim do gancho de −0,1 m a +0,5 m em torno de `queda` acima do topo da carga; a altura gravada é a da geometria, não a folga medida no instante do engate.
**Exemplos:**
- carga 2 × 2 m (r = 1,41 m) a 60°: queda = 1,41 · tan 60° = 2,45 m e linga de 2,83 m
- a mesma carga a 45°: queda = 1,41 m
- ângulo informado de 20° ou de 88° → 422
**Exceções:** a tela não tem controle do ângulo da linga (backend e cliente aceitam; fica o padrão). A altura de amarração medida na cena (`hook_attach_m`) ainda não vai no `site`: vale o padrão de 1,05 m. Cargas pequenas e compridas ficam com lingas mais altas que antes, e planos com pouco vão (sob arco, galpão) podem fechar só com ângulo menor.
**Testes relacionados:** `backend/tests/domain/services/test_rigging.py`, `backend/tests/fixtures/sling_geometry_cases.json` (lida também pelo vitest), `frontend/tests/domain/rigging`
**Origem:** decisão F-19 do Anderson Sehnem, em chat em 2026-10-17 (delegada ao agente)

---

## Regras por domínio (índice)

| Área | Regras |
|------|--------|
| Tabelas de carga e configuração | RN-001, RN-002, RN-004, RN-005, RN-007 |
| Modelo 3D | RN-003 |
| Unidades | RN-006 |
| Validação frontend ↔ backend | RN-008 |
| Içamento com dois guindastes | RN-016 |
| Estabilidade, vento e inclinação (física) | RN-017 (substitui RN-013 e RN-015) |
| Rede elétrica aérea | RN-018 |
| Içamento crítico | RN-019 |
| Altura das lingas (geometria única) | RN-020 |

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
