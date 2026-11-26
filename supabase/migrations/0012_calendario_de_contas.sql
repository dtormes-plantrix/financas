-- Atualização 0012: calendário de contas.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".

-- Dia em que a fatura do cartão foi marcada como paga no calendário de contas.
alter table faturas_informadas add column if not exists paga_em date;

-- O crédito contratado vence todo dia 18.
update compromissos set dia_vencimento = 18
where nome = 'Crédito contratado' and dia_vencimento is null;
