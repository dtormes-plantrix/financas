-- Atualização 0003: transferências entre contas, descontos fixos das rendas
-- e o dia de vencimento do crédito contratado.
-- Pode rodar mais de uma vez sem problema.

-- 1. Transferência: o dinheiro sai de uma conta sua e entra em outra conta sua.
--    Não conta como gasto nem como renda, só muda o saldo das duas contas.
alter table lancamentos drop constraint if exists lancamentos_tipo_check;
alter table lancamentos add constraint lancamentos_tipo_check
  check (tipo in ('entrada', 'saida', 'transferencia'));
alter table lancamentos add column if not exists conta_destino_id uuid references contas (id);

-- 2. Descontos fixos da renda (ex.: contabilidade e INSS da Plantrix),
--    em reais, além do imposto em porcentagem.
alter table fontes_renda add column if not exists descontos_fixos numeric(12, 2) not null default 0;

-- 3. O crédito contratado vence todo dia 18.
update compromissos set dia_vencimento = 18 where nome = 'Crédito contratado';
