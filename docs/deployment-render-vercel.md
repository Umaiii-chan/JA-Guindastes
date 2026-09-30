# Deploy da demonstração — Render + Vercel

## Custo e tempo esperados

Configuração manual: cerca de 20–35 minutos depois do merge. O Blueprint usa os planos gratuitos do
Render para o backend e o PostgreSQL; a Vercel pode usar o plano Hobby. O custo previsto é zero,
sujeito aos limites das duas contas.

No Render gratuito, o backend hiberna depois de 15 minutos sem tráfego e pode levar cerca de um
minuto para acordar. O banco expira 30 dias após a criação e não tem backup. Crie os recursos menos
de 30 dias antes da apresentação.

## 1. Preparar o Render

1. Faça merge da TASK-049 em `development`.
2. No Render, crie um **Blueprint** a partir do repositório e selecione `render.yaml`.
3. Quando solicitado, defina `ADMIN_PASSWORD` com uma senha forte de pelo menos 12 caracteres.
4. Confirme os três recursos e aguarde o backend ficar `Live`.
5. Copie a origem exibida, por exemplo `https://ja-guindastes-api.onrender.com`, sem `/` no fim.

Na inicialização, migrations, seed FICTÍCIO e admin são executados de forma idempotente.
`ADMIN_USERNAME` começa como `admin-apresentacao`.

## 2. Preparar a Vercel

1. Importe o mesmo repositório e escolha `frontend` como **Root Directory**.
2. Confirme que a URL do backend é `https://ja-guindastes-api.onrender.com`. Se o Render atribuiu
   outra URL, atualize o primeiro `destination` de `frontend/vercel.json` antes de publicar.
3. Selecione a branch `development` para a demonstração e publique.

`frontend/vercel.json` usa `npm run build:vercel`, encaminha `/api/*` ao Render e devolve as demais
rotas ao `index.html`. Essa build desliga o WebSocket e usa o fallback REST existente.

## 3. Teste de fumaça

1. Abra `https://<projeto>.vercel.app/api/v1/health`; deve responder `status: ok` e banco `UP`.
2. Abra a aplicação em janela anônima e entre como `admin-apresentacao`.
3. Confirme os dados `FICTÍCIO` em Catálogo e Tabelas.
4. No Simulador, selecione a configuração de demonstração, informe a carga e aguarde a avaliação.
5. No DevTools, confirme pedidos REST em `/api/v1/evaluations` e ausência de tentativas WebSocket.

Faça esse teste no dia anterior. No dia da apresentação, abra a aplicação 15 minutos antes e acesse
`/api/v1/health` periodicamente para evitar a hibernação. Guarde a demo local como contingência.

## 4. Operação e segurança

- Troque `ADMIN_PASSWORD` no Render somente junto com a recriação controlada do usuário; o comando
  idempotente não altera senha de usuário existente.
- Não grave senha, URL interna do banco ou tokens no repositório ou na Vercel.
- O banco não aceita conexões públicas (`ipAllowList: []`).
- O filesystem é efêmero: arquivos importados somem em reinícios, hibernações e redeploys. Os pontos
  estruturados no PostgreSQL continuam enquanto o banco gratuito existir; mantenha a planilha local.
- Depois da banca, exclua os recursos que não forem mais necessários. A promoção para
  `homologation` ou `production` continua sendo decisão da pessoa responsável.
