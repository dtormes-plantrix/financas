# WhatsApp do Finanças

Mande no WhatsApp um gasto ("mercado 85 cartão MP"), uma entrada ("recebi 1500 aluguel")
ou a foto/PDF de um comprovante, e ele vira lançamento no app. Responda **desfaz** para
apagar o último. Só os números do Diego e da Jô são atendidos.

## Passo a passo (uma vez só)

1. **Supabase:** rode `supabase/migrations/0010_whatsapp.sql` no SQL Editor.
2. **Meta** (developers.facebook.com → seu app → WhatsApp → Configuração da API):
   - copie o **ID do número de telefone**;
   - gere a **chave (token)**. A de teste vale 24 horas; a definitiva sai de um
     "usuário do sistema" no Gerenciador de Negócios, com a permissão `whatsapp_business_messaging`;
   - em Configurações do app → Básico, copie a **Chave secreta do app**.
3. **Supabase → Project Settings → API:** copie a chave **service_role** (secreta, nunca mande para ninguém).
4. **Vercel → Settings → Environment Variables**, crie:

   | Nome | Valor |
   |---|---|
   | `WHATSAPP_TOKEN` | a chave (token) da Meta |
   | `WHATSAPP_NUMERO_ID` | o ID do número de telefone |
   | `WHATSAPP_APP_SECRET` | a chave secreta do app |
   | `WHATSAPP_VERIFICACAO` | uma senha que você inventar, ex.: `financas-2026-xyz` |
   | `WHATSAPP_PESSOAS` | `55DDDNUMERO:diego,55DDDNUMERO:jo` (só dígitos) |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave service_role |

   Depois, em Deployments, clique em **Redeploy** no último.
5. **Meta → WhatsApp → Configuração → Webhook → Editar:**
   - URL de retorno: `https://financas-eight-mocha.vercel.app/api/whatsapp`
   - Token de verificação: a mesma senha de `WHATSAPP_VERIFICACAO`
   - Clique em Verificar e salvar, depois **Gerenciar** e assine **messages**.
6. Mande "oi" para o número do app. Ele responde com exemplos.

## Custos

- Meta: grátis quando vocês escrevem e o app responde (em até 24 horas).
- Anthropic: centavos por recado (mesma IA da leitura de comprovantes).
