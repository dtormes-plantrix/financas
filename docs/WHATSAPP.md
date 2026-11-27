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

## Relatório e avisos de orçamento

Todo dia às 8h (Cuiabá) a Vercel chama `/api/relatorio` (veja `vercel.json`):

- **Segunda:** resumo da semana (gastos, orçamento, contas dos próximos 7 dias e previsão).
- **Dia 1:** fechamento do mês anterior.
- **Qualquer dia:** aviso quando uma categoria passa de 90% ou estoura o orçamento (uma vez por mês cada).
- A qualquer hora, mande **resumo** ou **fechamento** no WhatsApp para receber na hora.
- Mande **vencidas** para ver as contas sem baixa numeradas e responda **paguei 1 3** (ou **paguei todas**). Fatura vira paga; parcela e despesa fixa viram lançamento, como no Calendário do app.

Regra da Meta: o app só manda texto livre até 24h depois da última mensagem da pessoa. Fora disso, manda um
**modelo de mensagem** aprovado, com o botão "Ver relatório"; ao tocar, chega o relatório completo.

### Criar os 2 modelos (uma vez)

No [WhatsApp Manager](https://business.facebook.com/wa/manage/message-templates/), conta "Financas Tormes",
**Criar modelo**, categoria **Utilidade**, idioma **Português (BR)**:

1. Nome `relatorio_financas`
   - Corpo: `Olá! O {{1}} das finanças da casa está pronto. A previsão para {{2}} é {{3}}. Toque no botão abaixo para ver os detalhes.`
   - Exemplos: `resumo da semana`, `dezembro`, `sobrar R$ 1.200,00`
   - Botão: **Resposta rápida** com o texto `Ver relatório`
2. Nome `aviso_orcamento`
   - Corpo: `Atenção: a categoria {{1}} já chegou a {{2}} do orçamento do mês. Gasto até agora: {{3}} de {{4}}. Confira os detalhes no app Finanças.`
   - Exemplos: `Mercado`, `92%`, `R$ 1.840,00`, `R$ 2.000,00`

Banco: rodar `supabase/migrations/0014_relatorio_whatsapp.sql` no SQL Editor do Supabase.
