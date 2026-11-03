# Lançar a partir do comprovante

Na tela **Lançar** tem o botão **Enviar comprovante**. Você escolhe a foto ou o PDF (Pix, cupom do cartão, nota), a IA lê e a tela já vem preenchida: valor, data, forma de pagamento, cartão ou conta e descrição. Você confere e toca em **Salvar**. Nada é salvo sem você conferir.

Custa cerca de 1 centavo por comprovante, pago à Anthropic com crédito que você coloca antes (não tem mensalidade).

## Parte 1: criar a conta e a chave da Anthropic (uma vez só)

1. Entre em https://console.anthropic.com e crie a conta (pode usar o mesmo e-mail).
2. Se pedir, escolha **Individual** e preencha nome e país.
3. No menu, abra **Billing** (ou **Plans & Billing**) e clique em **Buy credits**. Coloque **US$ 5** (dá para milhares de comprovantes). Deixe o **Auto reload** desligado para nunca cobrar sozinho.
4. No menu, abra **API Keys** e clique em **Create Key**. Nome: `financas`. Clique em **Create**.
5. Copie a chave (começa com `sk-ant-`). Ela aparece **uma vez só**; se perder, é só criar outra.

## Parte 2: colocar a chave na Vercel

1. Entre em https://vercel.com, abra o projeto **financas** > **Settings** > **Environment Variables**.
2. Adicione a primeira:
   - Key: `ANTHROPIC_API_KEY`
   - Value: a chave `sk-ant-...` do passo anterior
   - Tipo **Secret** (essa é secreta; as do Supabase continuam como estão). Environments: **Production**.
3. Adicione a segunda (é a senha do Atalho do iPhone, da Parte 3):
   - Key: `ATALHO_CHAVE`
   - Value: a senha que eu te mandei na conversa (ou invente uma longa, só letras e números)
   - Tipo **Secret**, Environments: **Production**.
4. Abra **Deployments**, no último clique nos **três pontinhos** > **Redeploy**. Espere ficar verde.

Pronto: o botão **Enviar comprovante** já funciona.

## Parte 3: Atalho do iPhone (mandar direto do WhatsApp)

Com ele, no WhatsApp você toca no comprovante > **Compartilhar** > **Lançar comprovante**, e o app abre com tudo preenchido.

1. Abra o app **Atalhos** e toque no **+** (canto de cima).
2. Toque no nome no topo, escolha **Renomear** e escreva `Lançar comprovante`.
3. Toque no **ⓘ** (ou no nome > **Detalhes**) e ligue **Mostrar na Folha de Compartilhamento**. Toque em **OK**.
4. No topo vai aparecer "Receber **Qualquer** entrada da **Folha de Compartilhamento**". Toque em **Qualquer** e deixe marcado só **Imagens** e **PDFs** (se não tiver PDFs, marque **Arquivos**).
5. Toque em **Adicionar ação**, procure **Obter Conteúdo do URL** e toque nela.
   - Toque no **URL** e cole (trocando SENHA pela senha do passo 3 da Parte 2):
     `https://financas-eight-mocha.vercel.app/api/comprovante?chave=SENHA`
   - Toque na setinha **>** ao lado da ação: **Método** = **POST**, **Corpo da Solicitação** = **Arquivo**, e no campo **Arquivo** escolha **Entrada do Atalho**.
6. Adicione a ação **Obter Valor do Dicionário**. Deixe "Obter **Valor** para **Chave** em **Conteúdo do URL**", e escreva `link` em **Chave**.
7. Adicione a ação **Abrir URLs**. Ela já pega o **Valor do Dicionário**.
8. Toque em **OK** no canto de cima. Pronto.

Para testar: no WhatsApp, abra um comprovante > **Compartilhar** (ícone de quadrado com seta) > role a lista e toque em **Lançar comprovante**. Na primeira vez o iPhone pergunta se pode acessar o site: toque em **Permitir sempre**.

O Atalho abre o app no **Safari**. Se você usa o app pelo ícone na tela de início, entre uma vez no app também pelo Safari (mesmo e-mail e senha), para ele já estar logado.

## Bom saber

- Fotos do iPhone (HEIC), prints, JPG, PNG e PDF funcionam.
- O app aprende o final do cartão: na primeira compra com o cartão final 7557, escolha o cartão certo antes de salvar; das próximas vezes ele já vem marcado (vale para cada celular).
- Pix entre você e a Jô vira **Entre contas**, não gasto.
- Se a IA errar alguma coisa, é só corrigir na tela antes de salvar.
