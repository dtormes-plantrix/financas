-- Atualização 0007: contas que se repetem todo mês (assinaturas, condomínio, luz, seguro).
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".

-- Conta fixa que cai no cartão: entra na fatura prevista do cartão, não nas parcelas.
alter table compromissos add column if not exists cartao_id uuid references cartoes (id) on delete set null;

-- Texto que aparece no extrato ou na fatura (ex.: "NETFLIX COM").
-- Quando um lançamento importado tem esse texto, o app entende que a conta do mês já foi paga.
alter table compromissos add column if not exists busca text;
