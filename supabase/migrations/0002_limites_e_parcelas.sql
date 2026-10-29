-- FINANÇAS · limites, saldos e parcelas mensais
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".

-- Limite usado do cartão, copiado do app do banco de vez em quando.
alter table cartoes add column if not exists limite_usado numeric(12, 2);
alter table cartoes add column if not exists limite_atualizado_em date;

-- Saldo da conta (negativo = cheque especial em uso), copiado do app do banco.
alter table contas add column if not exists saldo numeric(12, 2);
alter table contas add column if not exists saldo_atualizado_em date;

-- Parcelas mensais fora do cartão: empréstimo, dívida, conta fixa.
-- A parcela número "parcela_inicial" vence em "mes_inicial" (AAAA-MM);
-- as seguintes vencem uma por mês até "total_parcelas".
-- Com "valor_total" (dívida), vale o que já foi pago: termina quando quitar,
-- e cada mês pode pagar mais ou menos que o "valor" combinado.
-- Sem total_parcelas e sem valor_total, repete todo mês (conta fixa).
create table if not exists compromissos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(12, 2) not null check (valor > 0),
  dia_vencimento int check (dia_vencimento between 1 and 31),
  mes_inicial text not null check (mes_inicial ~ '^\d{4}-\d{2}$'),
  parcela_inicial int not null default 1 check (parcela_inicial >= 1),
  total_parcelas int check (total_parcelas >= 1),
  valor_total numeric(12, 2) check (valor_total > 0),
  conta_id uuid references contas (id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table compromissos enable row level security;
drop policy if exists "so membros" on compromissos;
create policy "so membros" on compromissos for all using (eh_membro()) with check (eh_membro());

-- Um lançamento pode ser o pagamento de uma parcela (botão "Paguei").
alter table lancamentos add column if not exists compromisso_id uuid references compromissos (id) on delete set null;

-- As duas parcelas que o Diego contou em 29/10/2026.
insert into compromissos (nome, valor, mes_inicial, parcela_inicial, total_parcelas)
select 'Crédito contratado', 1014.22, '2026-11', 7, 18
where not exists (select 1 from compromissos where nome = 'Crédito contratado');

-- R$ 8.500, com R$ 500 por mês a partir de novembro de 2026 (termina quando quitar).
insert into compromissos (nome, valor, mes_inicial, valor_total)
select 'Devolver poupança do João', 500, '2026-11', 8500
where not exists (select 1 from compromissos where nome = 'Devolver poupança do João');
