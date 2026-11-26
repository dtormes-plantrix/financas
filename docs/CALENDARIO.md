# Calendário de contas

Tela **Contas a pagar** (`/contas`). No celular, abre tocando no quadro "Contas a pagar" do Início; no computador, também pelo menu.

Mostra o que vence, em quatro faixas: **vencidas** (últimos 30 dias), **vencem hoje**, **próximos 7 dias** e **próximos 30 dias**. Cada conta tem o botão **Marcar como paga** ("Paguei" no celular).

## O que entra
- **Faturas dos cartões**, no dia de vencimento de cada cartão (MP e Sicredi dia 13, Nubank dia 27). Marcar a fatura como paga não lança gasto novo: as compras já estão lançadas. Dá para desfazer em "Já pagas neste mês".
- **Parcelas e contas fixas fora do cartão** (Ajustes › Contas que se repetem): crédito contratado (dia 18), poupança do João e as contas confirmadas. Marcar como paga cria o lançamento ligado à conta, igual ao botão "Paguei" do Extrato. Conta sem dia marcado aparece "até" o último dia do mês.
- **Despesas fixas do Studio e do Espaço**: as do mês anterior se repetem no mesmo dia até serem lançadas. Marcar como paga lança a despesa no negócio.
- Contas fixas que caem no cartão não aparecem sozinhas: já estão dentro da fatura.

## Atualização do banco
Rode `supabase/migrations/0012_calendario_de_contas.sql` no SQL Editor do Supabase (cole tudo e clique em Run). Ela guarda quando a fatura foi paga e põe o dia 18 no crédito contratado. Sem ela, a tela funciona, mas marcar fatura como paga dá aviso.
