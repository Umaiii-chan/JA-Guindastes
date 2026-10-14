# Pré-Banca Parcial 1 — roteiro de fala

Apresentação principal: slides 1–15, aproximadamente 15 minutos. Slides 16–18: apêndices.

## 1. Simulador de Guindastes

Tempo sugerido: 40 segundos. Apresentar o projeto como ferramenta web para apoiar a análise de tabelas de carga. Esta é a primeira defesa de escopo, requisitos, modelagem e prototipagem. O período da Estação 2 é setembro a outubro de 2026. A demonstração usa dados fictícios e não certifica uma operação real.

Fontes: Pedido da Estação 2 fornecido pela pessoa responsável; docs/project-overview.md

## 2. O problema de planejamento

Tempo: 50 segundos. O ponto central é relacionar geometria e tabela de carga. Uma imagem 3D isolada não informa a capacidade. A configuração e a posição mudam qual ponto da tabela se aplica. Não afirmar ganhos de produtividade medidos, pois ainda não há estudo de campo.

Fontes: docs/project-overview.md §§ 1–2; docs/business-rules.md RN-001 a RN-004

## 3. Escopo da solução

Tempo: 50 segundos. O recorte do MVP é selecionar um equipamento, manipular a cena e obter uma avaliação rastreável. A ferramenta apoia o planejamento. Certificação, cálculo estrutural, solo e telemetria permanecem fora do escopo. Persistência de simulações aparece como evolução modelada.

Fontes: docs/project-overview.md § 5; docs/requirements/functional.md

## 4. Requisitos que orientam a modelagem

Tempo: 60 segundos. Explicar a rastreabilidade entre requisito e artefato. Os documentos mantêm o status formal Proposto, mesmo quando há implementação parcial. Os grupos resumem requisitos existentes, não criam novos critérios de negócio. Desempenho interativo ainda precisa de medição.

Fontes: docs/requirements/functional.md; docs/requirements/non-functional.md

## 5. Casos de uso: interação principal

Tempo: 60 segundos. Vista simplificada para exposição, derivada do diagrama fornecido. As associações ligam atores às ações. Avaliar operação inclui calcular geometria e consultar capacidade. O diagrama original completo está no apêndice. Salvar simulações, upload do modelo 3D e níveis de alerta são parte do planejamento, não uma entrega existente.

Fontes: docs/produto/diagrams/04_casos_de_uso.dot; docs/architecture.md; docs/known-gaps.md

## 6. Classes: catálogo e referência de capacidade

Tempo: 65 segundos. Os compartimentos mostram nomes e atributos centrais da modelagem estática. Um fabricante tem modelos, um guindaste tem configurações e cada configuração tem tabelas versionadas. Capacidade pertence ao ponto da tabela, não ao modelo 3D. Os atributos completos e os vínculos visuais estão no original do apêndice. A implementação também considera a zona de giro, conforme ADR-018.

Fontes: Imagem de classes fornecida; docs/produto/diagrams/05_diagrama_classes_dominio.dot; docs/business-rules.md RN-001 a RN-005; docs/decisions/ADR-018-zonas-de-giro-e-peso-do-gancho.md

## 7. Classes: estado e resultado da simulação

Tempo: 60 segundos. Explicar a distinção entre a intenção de persistência e o fluxo atual. Simulation agrega configuração, guindaste e carga. SimulationState descreve uma posição. SimulationResult é opcional para um estado ainda não avaliado. A avaliação atual é transitória e não grava essas entidades. Crane3DModel e CraneKinematics representam a preparação visual e os vínculos do equipamento.

Fontes: Imagem de classes fornecida; docs/produto/diagrams/05_diagrama_classes_dominio.dot; docs/architecture.md; backend/app/application/use_cases/evaluate_operation.py

## 8. Arquitetura e autoridade do cálculo

Tempo: 60 segundos. React e Three.js cuidam da interação e da pré-visualização. O backend recalcula a geometria, consulta a tabela e devolve a avaliação. REST atende cadastros e o fallback de avaliação, WebSocket atende o ciclo interativo. PostgreSQL armazena catálogo e tabelas. O arquivo 3D não define capacidade e a cena não substitui a validação do domínio.

Fontes: docs/architecture.md §§ 1–4; docs/business-rules.md RN-003 e RN-008

## 9. Protótipo visual do Canvas interativo

Tempo: 75 segundos. Percorrer a interface da esquerda para a direita: etapas guindaste, carga e posição; controles com unidade; cena com vistas; resultado do backend. Esta captura existente usa dados fictícios e respostas de demonstração. Números da prévia e do backend nesta captura não devem ser usados como evidência de precisão. A captura demonstra layout, não validação de engenharia.

Fontes: docs/assets/screenshots/simulador-1440x900.png; docs/decisions/ADR-019-visual-manual-tecnico.md; docs/decisions/ADR-017-navegacao-e-design-system-do-frontend.md

## 10. Usabilidade e comunicação do resultado

Tempo: 60 segundos. Destacar texto junto à cor e a distinção entre resultado e prévia. Na ausência de dados, mostrar motivos. A interface evita exigir que o operador interprete apenas a cena. A usabilidade ainda precisa de teste com usuários: propor tarefas de selecionar configuração, mudar raio e interpretar por que não é possível avaliar. A captura é uma evidência de protótipo, não de homologação.

Fontes: docs/assets/screenshots/simulador-acima-da-capacidade-1440x900.png; docs/testing-strategy.md § 7

## 11. Sequência UML: solicitação e cálculo

Tempo: 90 segundos. Percorrer as linhas de vida da esquerda para a direita. Pré-condições: configuração selecionada e sessão válida no modo com banco. Para cada alteração, o frontend atualiza a prévia e envia o estado com debounce e sequence. O transporte preferido é WebSocket, com fallback REST. A API valida o contrato. EvaluateOperation busca ficha e regras, usa serviços de domínio e obtém tabelas ativas por configuração e zona. O diagrama resume chamadas para caber na exposição. O fluxo completo editável em Mermaid acompanha o material.

Fontes: docs/apresentacoes/estacao-2/sequencia-avaliacao.mmd; backend/app/application/use_cases/evaluate_operation.py; frontend/src/application/evaluation/EvaluationSession.ts

## 12. Sequência UML: resultado e alternativas

Tempo: 90 segundos. Continuação da mesma avaliação, com ativação abreviada. Após obter tabelas e geometria, o domínio consulta capacidade de forma conservadora. O fragmento alt distingue avaliação suportada de falta de dados ou consulta fora do domínio. Se a capacidade é zero, a utilização é indefinida. A resposta transporta versão e motivos quando disponíveis. A interface rejeita respostas antigas e apresenta os dados. Não há gravação de Simulation neste fluxo. EVALUATED não significa certificação de segurança.

Fontes: docs/apresentacoes/estacao-2/sequencia-avaliacao.mmd; backend/app/application/use_cases/evaluate_operation.py; frontend/src/application/evaluation/EvaluationSession.ts

## 13. Critérios técnicos para a defesa

Tempo: 70 segundos. Demonstrar por que as decisões são justificáveis. O modelo separa representação e capacidade. O backend é a autoridade. Não se extrapola. Cada resultado carrega a versão de tabela quando há consulta. A regra conservadora usa lança tabelada e a menor capacidade entre raios vizinhos. Fronteiras de zonas usam a menor capacidade e ficam não avaliáveis se uma zona não tem dados. Os limiares de atenção e crítico continuam pendentes.

Fontes: docs/business-rules.md; docs/decisions/ADR-015-consulta-conservadora-provisoria.md; docs/decisions/ADR-018-zonas-de-giro-e-peso-do-gancho.md

## 14. Validação e próximos passos

Tempo: 65 segundos. Separar o que existe do que falta demonstrar. O repositório contém testes unitários, de API e E2E, mas a existência deles não comprova homologação com tabelas oficiais nem usabilidade. Para outubro, apresentar este roteiro como proposta de trabalho: validar ficha e método com a empresa, ensaiar cenários conhecidos, testar interpretação com usuários e revisar artefatos. Não prometer datas ou resultados que não foram aprovados.

Fontes: docs/testing-strategy.md; docs/known-gaps.md; Pedido da Estação 2

## 15. Síntese para a pré-banca

Tempo: 40 segundos. Retomar a tese: os casos de uso explicam quem interage; as classes organizam as referências; a sequência mostra como a avaliação acontece; o protótipo permite discutir o uso. Encerrar convidando a banca a avaliar o recorte e a clareza da modelagem. O restante do arquivo é material de apoio para perguntas.

Fontes: Pedido da Estação 2; docs/project-overview.md

## 16. Apêndice: casos de uso originais

Material de apoio. Preservação integral do diagrama fornecido, também existente na documentação v0.1. A notação original usa setas e o texto inclui em vez da sintaxe UML padronizada. Importar modelo 3D, salvar simulação e níveis de alerta são planejados. A vista de exposição simplifica a apresentação sem alterar este original.

Fontes: docs/produto/diagrams/04_casos_de_uso.png; Imagem fornecida pela pessoa responsável

## 17. Apêndice: classes do domínio originais

Material de apoio. Diagrama completo preservado, com todos os atributos e relacionamentos fornecidos. Modelo conceitual não equivale ao esquema atual do banco. O ponto de interrogação em center_of_gravity marca o caráter opcional/a validar da origem. A versão atual de implementação agrega zonas de giro e peso do gancho, ausentes nesta imagem histórica.

Fontes: docs/produto/diagrams/05_diagrama_classes_dominio.png; Imagem fornecida pela pessoa responsável; docs/decisions/ADR-018-zonas-de-giro-e-peso-do-gancho.md

## 18. Fontes e material de apoio

As notas de cada slide indicam as fontes específicas. Todos os conteúdos factuais desta apresentação derivam do pedido, da documentação ou dos arquivos do projeto. Os diagramas originais estão congelados na documentação v0.1. O Mermaid acompanha a apresentação e permite editar a sequência completa. As capturas usam dados fictícios. O roteiro de fala contém a condução sugerida.

Fontes: Documentação local do projeto
