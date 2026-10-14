import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Dependências fornecidas pelo runtime de artefatos, sem instalar pacotes no projeto.
const root = process.cwd();
const runtime = process.env.RUNTIME_NODE_MODULES;
if (!runtime) throw new Error('Defina RUNTIME_NODE_MODULES');
const req = createRequire(path.join(runtime, '__runtime__.cjs'));
const { Presentation, PresentationFile } = await import(pathToFileURL(req.resolve('@oai/artifact-tool')));
const skill = process.env.PRESENTATIONS_SKILL_DIR;
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')));
const tmp = path.join(root, 'build/estacao-2/privado');
const out = path.join(root, 'build/estacao-2/entrega');
await fs.mkdir(tmp, { recursive: true });
await fs.mkdir(out, { recursive: true });
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const C = { bg:'#F4F1EA', ink:'#20241F', muted:'#5C625C', line:'#C8C7BC', blue:'#244D63', green:'#2F6B3A', red:'#B42318', white:'#FFFFFF' };
const FONT = 'Arial';
const notes = [];
function text(s, value, x,y,w,h,size=27,bold=false,color=C.ink,align='left') {
  const q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  q.text=value;
  q.text.style={typeface:FONT,fontSize:size,bold,color,alignment:align,verticalAlignment:'middle',autoFit:'none',wrap:true};
  return q;
}
function rect(s,x,y,w,h,fill='none',stroke=C.line) {
  return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:1.3}});
}
function line(s,x1,y1,x2,y2,dash=false,color=C.line) {
  const a=rect(s,x1,y1,0.1,0.1,'none','none'), b=rect(s,x2,y2,0.1,0.1,'none','none');
  const q=s.shapes.connect(a,b,{kind:'straight',fromSide:'right',toSide:'left',line:{fill:color,width:1.4,style:dash?'dashed':'solid'}});
  q.bringToFront();return q;
}
function arrow(s,x1,y,x2,label,returned=false,size=20) {
  const a=rect(s,x1,y,0.1,0.1,'none','none'),b=rect(s,x2,y,0.1,0.1,'none','none');
  s.shapes.connect(a,b,{kind:'straight',line:{fill:C.blue,width:1.8,style:returned?'dashed':'solid'},tail:{type:returned?'arrow':'triangle',width:'sm',length:'sm'}});
  text(s,label,Math.min(x1,x2)+7,y-29,Math.abs(x2-x1)-14,28,size,false,C.ink);
}
function slide(title, speech, sources=[], sub='') {
  const s=p.slides.add();s.background.fill=C.bg;
  text(s,title,55,35,1170,65,40,true);
  if(sub) text(s,sub,57,103,1165,45,21,false,C.muted);
  text(s,String(p.slides.items.length).padStart(2,'0'),1170,673,55,24,15,false,C.muted,'right');
  const n=speech+'\n\nFontes: '+sources.join('; ');
  s.speakerNotes.textFrame.setText(n);
  notes.push({title,speech,sources});return s;
}
async function img(s,file,x,y,w,h) {
  s.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,file))),contentType:'image/png',position:{left:x,top:y,width:w,height:h},fit:'contain',alt:file});
}
function item(s,n,title,body,y) {
  text(s,n,58,y,90,50,n==='RNF'?27:31,true,C.blue);
  text(s,title,145,y,1035,43,29,true);
  text(s,body,145,y+48,1035,64,25,false,C.muted);
}
function box(s,name,attrs,x,y,w=280,h=156) {
  const q=rect(s,x,y,w,h,C.white,C.blue);
  text(s,name,x+12,y+8,w-24,34,23,true,C.blue);
  line(s,x,y+51,x+w,y+51,false,C.blue);
  text(s,attrs,x+12,y+60,w-24,h-66,21);
  return q;
}
function relation(s,a,b,label,x,y,w=140,fromSide='right',toSide='left') {
  s.shapes.connect(a,b,{kind:'straight',fromSide,toSide,line:{fill:C.blue,width:1.5}});
  text(s,label,x,y,w,28,19,false,C.blue,'center');
}

let s=slide('Simulador de Guindastes',
  'Tempo sugerido: 40 segundos. Apresentar o projeto como ferramenta web para apoiar a análise de tabelas de carga. Esta é a primeira defesa de escopo, requisitos, modelagem e prototipagem. O período da Estação 2 é setembro a outubro de 2026. A demonstração usa dados fictícios e não certifica uma operação real.',
  ['Pedido da Estação 2 fornecido pela pessoa responsável','docs/project-overview.md']);
text(s,'Modelagem e prototipagem',60,165,590,145,55,true);
text(s,'Pré-Banca Parcial 1\nEstação 2\nSetembro a outubro de 2026',63,390,560,140,28,false,C.muted);
await img(s,'docs/assets/screenshots/cena-3d/dentro-lateral-900x900.png',665,130,550,510);

s=slide('O problema de planejamento',
 'Tempo: 50 segundos. O ponto central é relacionar geometria e tabela de carga. Uma imagem 3D isolada não informa a capacidade. A configuração e a posição mudam qual ponto da tabela se aplica. Não afirmar ganhos de produtividade medidos, pois ainda não há estudo de campo.',
 ['docs/project-overview.md §§ 1–2','docs/business-rules.md RN-001 a RN-004']);
text(s,'Qual capacidade corresponde\na esta posição do guindaste?',60,160,1120,125,47,true,C.blue);
item(s,'01','Configuração do equipamento','Lança, estabilizadores e condições da tabela selecionam a referência.',325);
item(s,'02','Posição e carga','Raio de trabalho, comprimento da lança e peso entram na avaliação.',480);

s=slide('Escopo da solução',
 'Tempo: 50 segundos. O recorte do MVP é selecionar um equipamento, manipular a cena e obter uma avaliação rastreável. A ferramenta apoia o planejamento. Certificação, cálculo estrutural, solo e telemetria permanecem fora do escopo. Persistência de simulações aparece como evolução modelada.',
 ['docs/project-overview.md § 5','docs/requirements/functional.md']);
text(s,'Recorte do MVP',60,155,545,50,31,true,C.blue);
text(s,'Selecionar equipamento e configuração\nConfigurar carga e posição 3D\nConsultar a tabela vinculada\nExibir capacidade e utilização',60,230,550,260,29);
text(s,'Limites do projeto',690,155,525,50,31,true,C.blue);
text(s,'Sem certificação de içamentos reais\nSem cálculo estrutural ou geotécnico\nSem telemetria de equipamentos\nModelos 3D exigem preparação',690,230,525,260,29);
text(s,'Salvar e consultar simulações permanece no modelo conceitual e na evolução prevista.',60,580,1120,55,24,false,C.muted);

s=slide('Requisitos que orientam a modelagem',
 'Tempo: 60 segundos. Explicar a rastreabilidade entre requisito e artefato. Os documentos mantêm o status formal Proposto, mesmo quando há implementação parcial. Os grupos resumem requisitos existentes, não criam novos critérios de negócio. Desempenho interativo ainda precisa de medição.',
 ['docs/requirements/functional.md','docs/requirements/non-functional.md']);
item(s,'RF','Seleção e manipulação','RF-010 a RF-015: equipamento, carga, controles de posição e geometria.',155);
item(s,'RF','Avaliação e retorno','RF-016 a RF-020: capacidade, utilização, resultado e domínio suportado.',315);
item(s,'RNF','Rastreabilidade e separação de responsabilidades','RNF-001, 002, 005 e 010: testes do motor, domínio isolado e versão da tabela.',475);

s=slide('Casos de uso: interação principal',
 'Tempo: 60 segundos. Vista simplificada para exposição, derivada do diagrama fornecido. As associações ligam atores às ações. Avaliar operação inclui calcular geometria e consultar capacidade. O diagrama original completo está no apêndice. Salvar simulações, upload do modelo 3D e níveis de alerta são parte do planejamento, não uma entrega existente.',
 ['docs/produto/diagrams/04_casos_de_uso.dot','docs/architecture.md','docs/known-gaps.md'],
 'Vista simplificada do modelo. O diagrama original completo está no apêndice.');
rect(s,265,160,950,470,'none',C.blue);text(s,'Simulador Web 3D',285,163,500,30,22,true,C.blue);
text(s,'«actor»\nOperador',60,245,180,75,26,true);
text(s,'«actor»\nAdministrador\ntécnico',60,465,185,105,24,true);
function oval(label,x,y,w=270,h=75){const o=s.shapes.add({geometry:'ellipse',position:{left:x,top:y,width:w,height:h},fill:C.white,line:{fill:C.blue,width:1.5}});text(s,label,x+15,y+9,w-30,h-18,23,false,C.ink,'center');return o;}
oval('Selecionar configuração',310,225);oval('Configurar carga e posição',310,335);const evaluate=oval('Avaliar operação',665,280);
const geo=oval('Calcular geometria',970,215,215);const cap=oval('Consultar capacidade',970,360,215);
oval('Manter catálogo',310,495);oval('Importar e ativar tabela',665,495);
line(s,210,290,310,263,false,C.blue);line(s,210,290,310,373,false,C.blue);line(s,210,290,665,317,false,C.blue);
line(s,235,525,310,532,false,C.blue);
line(s,235,560,275,600,false,C.blue);line(s,275,600,800,600,false,C.blue);line(s,800,600,800,570,false,C.blue);
for(const target of [geo,cap]) s.shapes.connect(evaluate,target,{kind:'straight',fromSide:'right',toSide:'left',line:{fill:C.blue,width:1.5,style:'dashed'},tail:{type:'arrow',width:'sm',length:'sm'}});
text(s,'«include»',810,224,150,28,18,false,C.blue);text(s,'«include»',810,403,150,28,18,false,C.blue);

s=slide('Classes: catálogo e referência de capacidade',
 'Tempo: 65 segundos. Os compartimentos mostram nomes e atributos centrais da modelagem estática. Um fabricante tem modelos, um guindaste tem configurações e cada configuração tem tabelas versionadas. Capacidade pertence ao ponto da tabela, não ao modelo 3D. Os atributos completos e os vínculos visuais estão no original do apêndice. A implementação também considera a zona de giro, conforme ADR-018.',
 ['Imagem de classes fornecida','docs/produto/diagrams/05_diagrama_classes_dominio.dot','docs/business-rules.md RN-001 a RN-005','docs/decisions/ADR-018-zonas-de-giro-e-peso-do-gancho.md'],
 'Modelo conceitual fornecido, com atributos centrais destacados');
const m=box(s,'Manufacturer','id\nname',60,185,280,150);
const c=box(s,'Crane','id, manufacturer_id\nmodel, description',490,185,280,150);
const cf=box(s,'CraneConfiguration','id, crane_id, name\nboom_config\ncounterweight, outriggers',920,185,300,176);
const lc=box(s,'LoadChart','id, configuration_id\nsource_document, version\nunits, status',920,440,300,180);
const pt=box(s,'LoadChartPoint','id, load_chart_id\nboom_length, working_radius\nmax_capacity',460,440,350,180);
relation(s,m,c,'1          1..*',340,235,150);relation(s,c,cf,'1          1..*',770,235,150);
relation(s,cf,lc,'',1075,382,135,'bottom','top');
text(s,'1',1078,362,50,25,19,false,C.blue);text(s,'1..*',1078,411,70,25,19,false,C.blue);
relation(s,lc,pt,'1..*          1',805,500,120,'left','right');
text(s,'A capacidade depende da configuração\ne da tabela vinculada.',60,437,335,150,29,true,C.blue);

s=slide('Classes: estado e resultado da simulação',
 'Tempo: 60 segundos. Explicar a distinção entre a intenção de persistência e o fluxo atual. Simulation agrega configuração, guindaste e carga. SimulationState descreve uma posição. SimulationResult é opcional para um estado ainda não avaliado. A avaliação atual é transitória e não grava essas entidades. Crane3DModel e CraneKinematics representam a preparação visual e os vínculos do equipamento.',
 ['Imagem de classes fornecida','docs/produto/diagrams/05_diagrama_classes_dominio.dot','docs/architecture.md','backend/app/application/use_cases/evaluate_operation.py'],
 'Persistência de simulações planejada. A avaliação atual não grava estes registros.');
const l=box(s,'Load','weight, dimensions\ncenter_of_gravity?',60,180,275,150);
const sim=box(s,'Simulation','crane_id, configuration_id\nload_id, status, created_at',485,180,310,150);
const st=box(s,'SimulationState','boom_length, boom_angle\nturret_rotation, cable_length\nworking_radius, hook_height',890,420,335,190);
const res=box(s,'SimulationResult','max_capacity, utilization\nstatus, reason',450,445,320,150);
relation(s,l,sim,'1          1..*',335,224,150);
relation(s,sim,st,'',815,340,130,'right','top');
text(s,'1',803,270,45,26,19,false,C.blue);text(s,'1..*',995,380,80,26,19,false,C.blue);
relation(s,st,res,'0..1      1',770,486,120,'left','right');
text(s,'Representação visual\nCrane3DModel\nCraneKinematics',65,420,330,145,27,true,C.blue);

s=slide('Arquitetura e autoridade do cálculo',
 'Tempo: 60 segundos. React e Three.js cuidam da interação e da pré-visualização. O backend recalcula a geometria, consulta a tabela e devolve a avaliação. REST atende cadastros e o fallback de avaliação, WebSocket atende o ciclo interativo. PostgreSQL armazena catálogo e tabelas. O arquivo 3D não define capacidade e a cena não substitui a validação do domínio.',
 ['docs/architecture.md §§ 1–4','docs/business-rules.md RN-003 e RN-008']);
item(s,'01','Interface e Canvas 3D','React + TypeScript + Three.js: entrada, visualização e prévia geométrica.',155);
item(s,'02','API e motor de avaliação','FastAPI + Python: validação, geometria e consulta da capacidade.',315);
item(s,'03','Catálogo e tabelas rastreáveis','PostgreSQL e arquivos de origem: configuração, pontos e versão da tabela.',475);

s=slide('Protótipo visual do Canvas interativo',
 'Tempo: 75 segundos. Percorrer a interface da esquerda para a direita: etapas guindaste, carga e posição; controles com unidade; cena com vistas; resultado do backend. Esta captura existente usa dados fictícios e respostas de demonstração. Números da prévia e do backend nesta captura não devem ser usados como evidência de precisão. A captura demonstra layout, não validação de engenharia.',
 ['docs/assets/screenshots/simulador-1440x900.png','docs/decisions/ADR-019-visual-manual-tecnico.md','docs/decisions/ADR-017-navegacao-e-design-system-do-frontend.md'],
 'Captura do protótipo com dados FICTÍCIOS. Valores ilustram a interface, não validam cálculos.');
await img(s,'docs/assets/screenshots/simulador-1440x900.png',65,160,890,490);
text(s,'Fluxo guiado\nGuindaste, carga e posição',985,180,250,100,25,true,C.blue);
text(s,'Controles com unidades\nVista 3D central\nResultado identificado\ncomo vindo do backend',985,320,250,220,25);

s=slide('Usabilidade e comunicação do resultado',
 'Tempo: 60 segundos. Destacar texto junto à cor e a distinção entre resultado e prévia. Na ausência de dados, mostrar motivos. A interface evita exigir que o operador interprete apenas a cena. A usabilidade ainda precisa de teste com usuários: propor tarefas de selecionar configuração, mudar raio e interpretar por que não é possível avaliar. A captura é uma evidência de protótipo, não de homologação.',
 ['docs/assets/screenshots/simulador-acima-da-capacidade-1440x900.png','docs/testing-strategy.md § 7'],
 'Comunicação por texto e números, além da cor');
await img(s,'docs/assets/screenshots/simulador-acima-da-capacidade-1440x900.png',60,155,865,485);
text(s,'Dentro da capacidade\nAcima da capacidade\nNão avaliável',960,180,260,170,28,true,C.blue);
text(s,'Teste previsto com usuários:\nseleção de equipamento,\nmanipulação da cena e\nleitura do resultado.\n\nAinda sem medição.',960,385,265,230,23,false,C.muted);

function participants(s,labels) {
  const xs=[120,325,530,745,965,1165];
  labels.forEach((v,i)=>{rect(s,xs[i]-87,150,174,60,C.white,C.blue);text(s,v.replace('EvaluateOperation','Evaluate\nOperation'),xs[i]-80,155,160,50,20,true,C.blue,'center');line(s,xs[i],210,xs[i],625,true);});
  return xs;
}
s=slide('Sequência UML: solicitação e cálculo',
 'Tempo: 90 segundos. Percorrer as linhas de vida da esquerda para a direita. Pré-condições: configuração selecionada e sessão válida no modo com banco. Para cada alteração, o frontend atualiza a prévia e envia o estado com debounce e sequence. O transporte preferido é WebSocket, com fallback REST. A API valida o contrato. EvaluateOperation busca ficha e regras, usa serviços de domínio e obtém tabelas ativas por configuração e zona. O diagrama resume chamadas para caber na exposição. O fluxo completo editável em Mermaid acompanha o material.',
 ['docs/apresentacoes/estacao-2/sequencia-avaliacao.mmd','backend/app/application/use_cases/evaluate_operation.py','frontend/src/application/evaluation/EvaluationSession.ts'],
 '1 de 2. Pré-condição: configuração selecionada e sessão válida no modo com banco.');
let xs=participants(s,['Operador','Interface /\nCanvas 3D','API REST /\nWebSocket','EvaluateOperation','Serviços\nde domínio','Provedores /\nPostgreSQL']);
rect(s,60,223,1160,398,'none',C.line);text(s,'loop [alteração operacional]',70,224,480,25,18,true,C.muted);
arrow(s,xs[0],285,xs[1],'Alterar posição',false,18);
arrow(s,xs[1],338,xs[2],'Enviar estado¹',false,18);
arrow(s,xs[2],391,xs[3],'Validar e avaliar',false,18);
arrow(s,xs[3],445,xs[5],'Obter ficha técnica e regras',false,19);
arrow(s,xs[5],493,xs[3],'Ficha, zonas e peso do gancho',true,19);
arrow(s,xs[3],548,xs[4],'Calcular geometria',false,18);
arrow(s,xs[3],601,xs[5],'Obter tabela ACTIVE por configuração e zona',false,18);
text(s,'¹ WebSocket aberto: simulation.state.changed. Caso contrário: POST /api/v1/evaluations.',65,639,1125,35,20,false,C.muted);

s=slide('Sequência UML: resultado e alternativas',
 'Tempo: 90 segundos. Continuação da mesma avaliação, com ativação abreviada. Após obter tabelas e geometria, o domínio consulta capacidade de forma conservadora. O fragmento alt distingue avaliação suportada de falta de dados ou consulta fora do domínio. Se a capacidade é zero, a utilização é indefinida. A resposta transporta versão e motivos quando disponíveis. A interface rejeita respostas antigas e apresenta os dados. Não há gravação de Simulation neste fluxo. EVALUATED não significa certificação de segurança.',
 ['docs/apresentacoes/estacao-2/sequencia-avaliacao.mmd','backend/app/application/use_cases/evaluate_operation.py','frontend/src/application/evaluation/EvaluationSession.ts'],
 '2 de 2. Continuação da mesma avaliação. Estratégia conservadora provisória, sem extrapolação.');
xs=participants(s,['Operador','Interface /\nCanvas 3D','API REST /\nWebSocket','EvaluateOperation','Serviços\nde domínio','Provedores /\nPostgreSQL']);
arrow(s,xs[5],258,xs[3],'Tabela(s), pontos, id e versão',true,19);
arrow(s,xs[3],307,xs[4],'Consultar capacidade¹',false,17);
arrow(s,xs[4],353,xs[3],'Capacidade / motivo',true,18);
rect(s,475,372,620,160,'none',C.blue);text(s,'alt [capacidade e utilização definidas]',487,378,595,24,18,true,C.blue);
arrow(s,xs[3],433,xs[2],'EVALUATED',true,18);
line(s,475,448,1095,448,true,C.blue);text(s,'[dados ausentes ou consulta não suportada]',487,451,590,24,18,true,C.blue);
arrow(s,xs[3],514,xs[2],'NOT_EVALUABLE²',true,17);
arrow(s,xs[2],574,xs[1],'Retornar resultado',true,17);
arrow(s,xs[1],623,xs[0],'Exibir resultado²',true,18);
text(s,'¹ Se houver geometria e tabelas válidas.  ² Inclui motivos. A interface descarta respostas antigas.',65,646,1115,30,19,false,C.muted);

s=slide('Critérios técnicos para a defesa',
 'Tempo: 70 segundos. Demonstrar por que as decisões são justificáveis. O modelo separa representação e capacidade. O backend é a autoridade. Não se extrapola. Cada resultado carrega a versão de tabela quando há consulta. A regra conservadora usa lança tabelada e a menor capacidade entre raios vizinhos. Fronteiras de zonas usam a menor capacidade e ficam não avaliáveis se uma zona não tem dados. Os limiares de atenção e crítico continuam pendentes.',
 ['docs/business-rules.md','docs/decisions/ADR-015-consulta-conservadora-provisoria.md','docs/decisions/ADR-018-zonas-de-giro-e-peso-do-gancho.md']);
item(s,'01','A cena representa, a tabela define capacidade','O backend valida o estado recebido e calcula o resultado da operação.',155);
item(s,'02','Dados insuficientes produzem um motivo explícito','Fora da tabela, sem ficha ou sem tabela ativa: resultado não avaliável.',315);
item(s,'03','Consulta rastreável e provisória','A avaliação informa a versão. O método definitivo depende da empresa.',475);

s=slide('Validação e próximos passos',
 'Tempo: 65 segundos. Separar o que existe do que falta demonstrar. O repositório contém testes unitários, de API e E2E, mas a existência deles não comprova homologação com tabelas oficiais nem usabilidade. Para outubro, apresentar este roteiro como proposta de trabalho: validar ficha e método com a empresa, ensaiar cenários conhecidos, testar interpretação com usuários e revisar artefatos. Não prometer datas ou resultados que não foram aprovados.',
 ['docs/testing-strategy.md','docs/known-gaps.md','Pedido da Estação 2'],
 'Roteiro proposto para concluir a Estação 2 em outubro');
item(s,'01','Conferir dados e regras com a empresa','Ficha geométrica, estratégia de consulta, arredondamento e níveis de alerta.',155);
item(s,'02','Executar cenários de referência','Capacidade conhecida, fronteira de zona e situação fora do domínio.',315);
item(s,'03','Avaliar o uso e revisar a modelagem','Observar tarefas no Canvas e ajustar o protótipo após a devolutiva da banca.',475);

s=slide('Síntese para a pré-banca',
 'Tempo: 40 segundos. Retomar a tese: os casos de uso explicam quem interage; as classes organizam as referências; a sequência mostra como a avaliação acontece; o protótipo permite discutir o uso. Encerrar convidando a banca a avaliar o recorte e a clareza da modelagem. O restante do arquivo é material de apoio para perguntas.',
 ['Pedido da Estação 2','docs/project-overview.md']);
text(s,'Uma avaliação compreensível,\nligada à configuração\ne à versão da tabela.',60,170,1150,230,52,true,C.blue);
text(s,'Escopo definido\nModelagem UML apresentada\nCanvas demonstrável para discussão de usabilidade',65,470,1120,145,29);

s=slide('Apêndice: casos de uso originais',
 'Material de apoio. Preservação integral do diagrama fornecido, também existente na documentação v0.1. A notação original usa setas e o texto inclui em vez da sintaxe UML padronizada. Importar modelo 3D, salvar simulação e níveis de alerta são planejados. A vista de exposição simplifica a apresentação sem alterar este original.',
 ['docs/produto/diagrams/04_casos_de_uso.png','Imagem fornecida pela pessoa responsável'],
 'Referência conceitual v0.1. Inclui funcionalidades ainda planejadas.');
await img(s,'docs/produto/diagrams/04_casos_de_uso.png',45,155,1190,480);

s=slide('Apêndice: classes do domínio originais',
 'Material de apoio. Diagrama completo preservado, com todos os atributos e relacionamentos fornecidos. Modelo conceitual não equivale ao esquema atual do banco. O ponto de interrogação em center_of_gravity marca o caráter opcional/a validar da origem. A versão atual de implementação agrega zonas de giro e peso do gancho, ausentes nesta imagem histórica.',
 ['docs/produto/diagrams/05_diagrama_classes_dominio.png','Imagem fornecida pela pessoa responsável','docs/decisions/ADR-018-zonas-de-giro-e-peso-do-gancho.md'],
 'Referência conceitual v0.1. Modelo completo para consulta e perguntas.');
await img(s,'docs/produto/diagrams/05_diagrama_classes_dominio.png',40,195,1200,390);

s=slide('Fontes e material de apoio',
 'As notas de cada slide indicam as fontes específicas. Todos os conteúdos factuais desta apresentação derivam do pedido, da documentação ou dos arquivos do projeto. Os diagramas originais estão congelados na documentação v0.1. O Mermaid acompanha a apresentação e permite editar a sequência completa. As capturas usam dados fictícios. O roteiro de fala contém a condução sugerida.',
 ['Documentação local do projeto']);
text(s,'Contexto e requisitos',60,170,545,45,29,true,C.blue);
text(s,'docs/project-overview.md\ndocs/requirements/functional.md\ndocs/requirements/non-functional.md\ndocs/business-rules.md',60,235,580,185,24);
text(s,'Modelagem e implementação',685,170,540,45,29,true,C.blue);
text(s,'docs/architecture.md\ndocs/produto/diagrams/\nADRs 015, 017, 018 e 019\nEvaluateOperation e EvaluationSession',685,235,540,185,24);
text(s,'Validação e limitações: docs/testing-strategy.md e docs/known-gaps.md\nSequência completa: sequencia-avaliacao.mmd\nNotas de fala e referências detalhadas no modo de apresentação.',60,490,1150,120,25,false,C.muted);

const candidate=path.join(tmp,'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidate);
console.log(`EXPORTADO: ${p.slides.items.length} slides`);
for(let i=0;i<p.slides.items.length;i++) {
  const slide=p.slides.items[i];
  const png=await p.export({slide,format:'png',scale:1.25});
  await fs.writeFile(path.join(tmp,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
await fs.writeFile(path.join(root,'docs/apresentacoes/estacao-2/roteiro-de-fala.md'),'# Pré-Banca Parcial 1 — roteiro de fala\n\nApresentação principal: slides 1–15, aproximadamente 15 minutos. Slides 16–18: apêndices.\n\n'+notes.map((n,i)=>`## ${i+1}. ${n.title}\n\n${n.speech}\n\nFontes: ${n.sources.join('; ')}\n`).join('\n'));
const final=path.join(out,'JA-Guindastes-Pre-Banca-Parcial-1-revisada.pptx');
await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:final,pythonExecutable:process.env.RUNTIME_PYTHON,
  integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],
  fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,
  receiptPath:path.join(tmp,'validation-revisada.json')});
console.log('FINAL: '+final);
