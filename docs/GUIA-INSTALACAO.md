# Guia de instalação (passo a passo)

São dois serviços gratuitos:
- **Supabase**: guarda os dados e cuida do login.
- **Vercel**: coloca o app no ar, com um endereço para abrir no celular.

Leva uns 20 minutos. Se travar em qualquer passo, mande um print no projeto.

## Parte 1: Supabase (os dados)

1. Entre em https://supabase.com e clique em **Start your project**. Entre com a sua conta do GitHub.
2. Clique em **New project**.
   - Name: `financas`
   - Database Password: clique em **Generate a password** e guarde num lugar seguro.
   - Region: **South America (São Paulo)**.
   - Clique em **Create new project** e espere uns 2 minutos.
3. No menu da esquerda, abra **SQL Editor**, clique em **New query**, cole todo o conteúdo do arquivo [`supabase/migrations/0001_inicial.sql`](../supabase/migrations/0001_inicial.sql) e clique em **Run**. Deve aparecer "Success".
4. Crie os dois logins: menu **Authentication** > **Users** > **Add user** > **Create new user**.
   - Um com o seu e-mail e uma senha, marcando **Auto Confirm User**.
   - Outro com o e-mail da Jô e uma senha para ela, também com **Auto Confirm User**.
5. Volte ao **SQL Editor**, nova query, cole o arquivo [`supabase/dados-iniciais.sql`](../supabase/dados-iniciais.sql), **troque** `EMAIL_DO_DIEGO` e `EMAIL_DA_JO` pelos e-mails do passo 4 e clique em **Run**. Isso libera vocês dois e já cadastra contas, cartões e rendas.
6. Para ninguém mais conseguir criar conta: **Authentication** > **Sign In / Providers** > desligue **Allow new users to sign up** e salve.
7. Pegue as duas chaves: **Project Settings** (engrenagem) > **API**. Copie:
   - **Project URL**
   - **anon public** (em "Project API keys")

## Parte 2: Vercel (o app no ar)

1. Entre em https://vercel.com e clique em **Sign Up** > **Continue with GitHub**.
2. Clique em **Add New…** > **Project** e escolha o repositório **financas** (se não aparecer, clique em **Adjust GitHub App Permissions** e libere o repositório).
3. Antes de clicar em Deploy, abra **Environment Variables** e crie as duas:
   - `NEXT_PUBLIC_SUPABASE_URL` = o Project URL do passo 7
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a chave anon public do passo 7
4. Clique em **Deploy** e espere uns 2 minutos. No fim aparece o endereço do app (algo como `financas-xxxx.vercel.app`).

## Parte 3: no celular

1. Abra o endereço do app no celular e entre com seu e-mail e senha.
2. Coloque o ícone na tela inicial:
   - **iPhone (Safari):** botão de compartilhar > **Adicionar à Tela de Início**.
   - **Android (Chrome):** menu ⋮ > **Adicionar à tela inicial** (ou **Instalar app**).
3. Mande o endereço para a Jô fazer o mesmo, com o login dela.

## Primeiro uso

1. Em **Ajustes**, confira os cartões e digite o **valor da fatura** de cada cartão que aparece no app do banco (este mês e o próximo). Assim o painel começa certo, mesmo antes de todas as compras estarem lançadas.
2. Preencha o valor do **Studio Pilates** em Rendas.
3. Quando uma renda cair na conta, lance como **Entrou** e escolha de onde veio. Ela sai de "Ainda vai entrar".
4. A partir daí, lancem tudo no dia a dia pelo botão **+**.

## Modo demonstração

Sem as chaves do Supabase o app abre em **modo demonstração**: os dados ficam só no aparelho, com exemplos. Serve para testar as telas antes de configurar tudo.
