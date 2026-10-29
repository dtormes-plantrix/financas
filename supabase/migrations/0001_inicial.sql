-- FINANÇAS · Fase 1
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".

-- Quem pode usar o sistema: só quem estiver nesta tabela (Diego e Jô).
create table membros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  apelido text not null check (apelido in ('diego', 'jo'))
);

create or replace function eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where user_id = auth.uid());
$$;

create table contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dono text not null check (dono in ('diego', 'jo', 'casa')),
  limite_cheque_especial numeric(12, 2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table cartoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dono text not null check (dono in ('diego', 'jo', 'casa')),
  limite numeric(12, 2),
  dia_fechamento int not null check (dia_fechamento between 1 and 31),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  conta_pagamento_id uuid references contas (id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table fontes_renda (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor_bruto numeric(12, 2),
  percentual_imposto numeric(5, 2) not null default 0,
  dia_previsto int check (dia_previsto between 1 and 31),
  conta_id uuid references contas (id),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida')),
  valor numeric(12, 2) not null check (valor > 0),
  data date not null default current_date,
  descricao text,
  forma text not null check (forma in ('pix', 'debito', 'dinheiro', 'credito')),
  conta_id uuid references contas (id),
  cartao_id uuid references cartoes (id),
  parcelas int not null default 1 check (parcelas between 1 and 48),
  fonte_id uuid references fontes_renda (id),
  categoria_id uuid references categorias (id),
  de_quem text not null default 'casa' check (de_quem in ('diego', 'jo', 'casa')),
  criado_por uuid default auth.uid() references auth.users (id),
  criado_em timestamptz not null default now(),
  check (forma <> 'credito' or cartao_id is not null)
);
create index lancamentos_data on lancamentos (data);

-- Valor da fatura tirado do app do banco, para o painel já começar certo
-- antes de todas as compras estarem registradas aqui.
create table faturas_informadas (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references cartoes (id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'), -- mês de vencimento, AAAA-MM
  valor numeric(12, 2) not null,
  unique (cartao_id, mes)
);

-- Segurança: cada tabela só abre para Diego e Jô.
alter table membros enable row level security;
alter table contas enable row level security;
alter table cartoes enable row level security;
alter table fontes_renda enable row level security;
alter table categorias enable row level security;
alter table lancamentos enable row level security;
alter table faturas_informadas enable row level security;

create policy "membros veem membros" on membros for select using (eh_membro());
create policy "so membros" on contas for all using (eh_membro()) with check (eh_membro());
create policy "so membros" on cartoes for all using (eh_membro()) with check (eh_membro());
create policy "so membros" on fontes_renda for all using (eh_membro()) with check (eh_membro());
create policy "so membros" on categorias for all using (eh_membro()) with check (eh_membro());
create policy "so membros" on lancamentos for all using (eh_membro()) with check (eh_membro());
create policy "so membros" on faturas_informadas for all using (eh_membro()) with check (eh_membro());
