# Visão geral do projeto

> **Status deste documento:** preenchido na TASK-002 a partir da documentação técnica v0.1
> ([`produto/documentacao-tecnica-v0.1.md`](produto/documentacao-tecnica-v0.1.md), citada abaixo
> como "doc-fonte § N"). Onde algo depende de validação, o texto diz **PENDENTE** ou **A VALIDAR**.
> Veja `AGENTS.md` § 1.

| Campo | Valor |
|-------|-------|
| Nome do projeto | Simulador Web 3D para Análise de Tabelas de Carga de Guindastes |
| Pessoa responsável | Anderson Sehnem |
| Repositório | `Umaiii-chan/JA-Guindastes` (GitHub, privado) |
| Última revisão deste documento | 2026-09-26 |

---

## 1. Problema que o sistema resolve *(obrigatório)*

Planejar um içamento exige cruzar a posição do guindaste, o comprimento e a inclinação da lança e o
raio de trabalho com a tabela de carga oficial da configuração do equipamento. Hoje esse cruzamento
é feito sem uma ferramenta gráfica interativa que calcule os limites em tempo real e avise quando a
operação sai da faixa segura. O projeto nasce como desafio industrial do curso de Engenharia de
Software (2º semestre de 2026), com a empresa parceira Guindastes Ribas Ltda. (doc-fonte § 1 e § 27).

## 2. Objetivo *(obrigatório)*

Permitir que um usuário selecione um guindaste e sua configuração, posicione e manipule o
equipamento e uma carga em um ambiente 3D, obtenha raio de trabalho, altura e demais parâmetros
operacionais e receba a capacidade admissível e alertas calculados a partir da tabela oficial
vinculada à configuração selecionada (doc-fonte § 1.1).

**Medida de sucesso:** a Definition of Done do MVP (doc-fonte § 24). Entre outros critérios: um
guindaste de demonstração carregado no navegador; uma tabela de carga oficial ou de validação
importada e versionada; casos de cálculo conhecidos passando nos testes; e a simulação de
demonstração repetível do início ao fim.

## 3. Usuários / público-alvo *(obrigatório)*

Fonte: doc-fonte § 3.

| Perfil | Quem é | O que precisa fazer no sistema |
|--------|--------|--------------------------------|
| Operador / Planejador | quem planeja o içamento | selecionar equipamento, configurar carga, manipular o cenário, analisar capacidade e alertas |
| Administrador técnico | quem mantém o cadastro | cadastrar guindastes, modelos 3D, configurações e tabelas de carga |
| Equipe técnica da empresa | Guindastes Ribas Ltda. | fornecer e validar dados oficiais, regras de uso e resultados do simulador |
| Equipe de desenvolvimento | estudantes do curso | implementar, testar, documentar e manter a solução |
| Professores / banca | avaliadores acadêmicos | avaliar requisitos, modelagem, arquitetura, MVP, testes e apresentação final |

## 4. Principais funcionalidades *(obrigatório)*

Resultado esperado do MVP, na ordem da doc-fonte § 1.2. Requisitos detalhados em
[`requirements/functional.md`](requirements/functional.md).

1. Cadastrar ao menos um modelo de guindaste.
2. Importar e visualizar seu modelo 3D.
3. Configurar os vínculos cinemáticos básicos do modelo.
4. Importar ao menos uma tabela de carga estruturada.
5. Configurar uma carga.
6. Manipular giro, lança, extensão e cabo no cenário.
7. Calcular dinamicamente os parâmetros geométricos relevantes.
8. Consultar/interpolar a tabela de carga (método **PENDENTE**: PEND-001).
9. Comparar a carga atual com a capacidade calculada.
10. Exibir o resultado e os alertas em tempo real (níveis **PENDENTES**: PEND-004).
11. Registrar dados suficientes para testar e reproduzir a simulação.

## 5. Escopo *(obrigatório)*

### Dentro do escopo (versão atual)

Fonte: doc-fonte § 2.1.

- Visualização 3D de guindastes e cargas.
- Importação de modelos 3D preparados para o simulador (GLB/glTF).
- Manipulação de componentes articulados do guindaste.
- Cadastro de fabricantes, modelos e configurações.
- Importação de tabelas de carga CSV/XLSX, preservando o documento original para rastreabilidade.
- Normalização de unidades e dados.
- Cálculo de raio de trabalho e dos parâmetros geométricos necessários.
- Algoritmo de interpolação/consulta das tabelas de carga.
- Alertas de operação conforme regras técnicas cadastradas.
- Armazenamento de simulações e resultados.
- Testes unitários do motor de cálculo, testes de integração da API e testes de usabilidade da interface 3D.
- Validação dos cálculos com tabelas oficiais do fabricante.

### Fora do escopo (explicitamente)

Agentes **não devem** implementar nada desta lista, mesmo que pareça útil (doc-fonte § 2.2):

- certificação formal de operações reais de içamento;
- cálculo estrutural completo do guindaste;
- simulação física avançada de deformação de lança/cabos;
- modelagem geotécnica do solo;
- integração direta com telemetria de guindastes reais;
- importação automática de qualquer CAD sem preparação/conversão;
- reconhecimento universal de tabelas a partir de PDFs não estruturados.

**Premissa de segurança** (doc-fonte § 2.3): o produto é ferramenta de planejamento e análise. O
sistema não inventa capacidade fora do domínio conhecido da tabela.

---

## 6. Stack resumida

Detalhes em [`architecture.md`](architecture.md) e [`development-guide.md`](development-guide.md).
Versões ainda não definidas: **A VALIDAR** na tarefa de toolchain.

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Linguagem | TypeScript (frontend); Python (backend) | A VALIDAR |
| Framework | React + Three.js (frontend); FastAPI (backend) | A VALIDAR |
| Banco de dados | PostgreSQL | A VALIDAR |
| Infra / deploy | Docker Compose em desenvolvimento (doc-fonte § 22); implantação fora do ambiente local: não definida | A VALIDAR |

## 7. Integrações externas

O MVP não integra com sistemas externos em tempo de execução (telemetria está fora do escopo). As
entradas externas são arquivos preparados e importados manualmente:

| Sistema | Para quê | Tipo (API, fila, arquivo...) | Documentação |
|---------|----------|------------------------------|--------------|
| Tabelas de carga do fabricante (via Guindastes Ribas) | capacidade admissível por configuração | arquivo CSV/XLSX (original PDF/XLSX/CSV preservado) | doc-fonte § 13; formato real **PENDENTE** (PEND-008) |
| Modelos 3D / CAD dos guindastes | visualização e cinemática | arquivo GLB/glTF preparado fora do runtime | doc-fonte § 12; disponibilidade **PENDENTE** (doc-fonte § 26, perguntas 2 e 3) |

## 8. Restrições

- Técnicas: navegadores desktop modernos com WebGL (RNF-009); modelos 3D em escala física
  consistente, metros como unidade interna (RNF-004); regras de domínio independentes de frameworks
  (RNF-002).
- De negócio: ferramenta de planejamento, não de certificação (doc-fonte § 2.3); capacidade só a
  partir de tabela/regra oficial vinculada à configuração (RN-004); dados oficiais dependem da
  empresa parceira. Prazo acadêmico: Estações 1 a 5, de agosto a dezembro de 2026 (doc-fonte § 23).
- De orçamento: nenhum custo obrigatório; agentes de IA usados pelas assinaturas, sem API paga
  ([ADR-003](decisions/ADR-003-orquestracao-local-via-clis-de-assinatura.md)).

## 9. Glossário

Só termos que a doc-fonte define (§ 10.2 e § 13.2). Termos usados sem definição precisa na doc-fonte
estão marcados e registrados em [`known-gaps.md`](known-gaps.md).

| Termo | Significado |
|-------|-------------|
| Manufacturer | fabricante; organiza modelos e documentação |
| Crane | modelo lógico do guindaste; não guarda uma capacidade global, porque a capacidade varia por configuração |
| Crane3DModel | versão do asset visual (URI, formato, escala, metadados) |
| CraneKinematics | mapeamento dos nós do GLB/glTF para funções do simulador (ex.: `turret`, `boom`, `boom_tip`, `hook`) e limites cinemáticos conhecidos |
| CraneConfiguration | configuração operacional capaz de selecionar uma tabela específica |
| LoadChart | cabeçalho/versionamento de uma tabela oficial normalizada; estados sugeridos `DRAFT → VALIDATED → ACTIVE → SUPERSEDED`, ou `INVALID` |
| LoadChartPoint | ponto discreto da tabela: `boom_length`, `working_radius`, `max_capacity` (extensível) |
| Load | carga da simulação, com peso e dimensões; centro de gravidade opcional até validação |
| Simulation | agrega equipamento, configuração, carga, status e histórico relevante |
| SimulationState | snapshot operacional: comprimento/ângulo da lança, giro, cabo, raio, altura |
| SimulationResult | resultado do motor: capacidade admissível, utilização, status e motivos/alertas |
| Raio de trabalho | **definição PENDENTE** (ponto de referência da medição não definido na doc-fonte) |
| Comprimento de lança | **definição PENDENTE** (tratamento de lança telescópica não definido na doc-fonte) |

## 10. Documentos relacionados

- Documentação técnica original (congelada): [`produto/documentacao-tecnica-v0.1.md`](produto/documentacao-tecnica-v0.1.md)
- Regras de negócio: [`business-rules.md`](business-rules.md)
- Requisitos: [`requirements/`](requirements/README.md)
- Decisões: [`decisions/`](decisions/README.md)
- Limitações conhecidas: [`known-gaps.md`](known-gaps.md)
