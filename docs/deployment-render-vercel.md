# Deploy da demonstração — Render + Vercel

## Custo e tempo esperados

Configuração manual: cerca de 20–35 minutos depois do merge. O primeiro build pode levar mais alguns
minutos. O Blueprint usa a menor configuração paga que mantém os arquivos importados:

- Render web `0.5c-512mb`: US$ 7/mês;
- Render Postgres `0.1c-256mb`: US$ 6/mês;
- disco persistente de 1 GB: US$ 0,25/mês;
- Vercel Hobby: sem custo para esta demonstração, sujeito aos limites da conta.

Confira os valores no painel antes de confirmar a criação. A cobrança do Render é proporcional ao
tempo de uso do compute; o disco é cobrado à parte.

## 1. Preparar o Render

1. Faça merge da TASK-049 em `development`.
2. No Render, crie um **Blueprint** a partir do repositório e selecione `render.yaml`.
3. Quando solicitado, defina `ADMIN_PASSWORD` com uma senha forte de pelo menos 12 caracteres.
4. Confirme os três recursos e aguarde o backend ficar `Live`.
5. Copie a origem exibida, por exemplo `https://ja-guindastes-api.onrender.com`, sem `/` no fim.

O Blueprint aplica migrations antes do deploy. Na inicialização, o seed FICTÍCIO e o admin são
criados de forma idempotente. `ADMIN_USERNAME` começa como `admin-apresentacao`.

## 2. Preparar a Vercel

1. Importe o mesmo repositório e escolha `frontend` como **Root Directory**.
2. Em Environment Variables, crie `RENDER_API_ORIGIN` com a origem copiada do Render para
   Production, Preview e Development.
3. Selecione a branch `development` para a demonstração e publique.

`frontend/vercel.mjs` usa `npm run build:vercel`, encaminha `/api/*` ao Render e devolve as demais
rotas ao `index.html`. Essa build desliga o WebSocket e usa o fallback REST existente.

## 3. Teste de fumaça

1. Abra `https://<projeto>.vercel.app/api/v1/health`; deve responder `status: ok` e banco `UP`.
2. Abra a aplicação em janela anônima e entre como `admin-apresentacao`.
3. Confirme os dados `FICTÍCIO` em Catálogo e Tabelas.
4. No Simulador, selecione a configuração de demonstração, informe a carga e aguarde a avaliação.
5. No DevTools, confirme pedidos REST em `/api/v1/evaluations` e ausência de tentativas WebSocket.

Faça esse teste no dia anterior e 30 minutos antes da apresentação. Guarde também a demo local como
plano de contingência.

## 4. Operação e segurança

- Troque `ADMIN_PASSWORD` no Render somente junto com a recriação controlada do usuário; o comando
  idempotente não altera senha de usuário existente.
- Não grave senha, URL interna do banco ou tokens no repositório ou na Vercel.
- O banco não aceita conexões públicas (`ipAllowList: []`).
- O disco limita o backend a uma instância e causa alguns segundos de indisponibilidade no redeploy.
- Para parar custos depois da banca, suspenda ou exclua os recursos no Render após exportar o que
  precisar. A promoção para `homologation` ou `production` continua sendo decisão da pessoa responsável.
