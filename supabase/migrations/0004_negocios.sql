-- Atualização 0004: caixas separados do Studio Pilates e do Espaço Soletti.
-- A Jô lança as entradas e saídas de cada negócio separado da casa.
-- Quando sobra dinheiro, ela passa para a casa, e isso vira renda da casa.
-- Pode rodar mais de uma vez sem problema.

create table if not exists negocios (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  fonte_id uuid references fontes_renda (id), -- a renda da casa que recebe as sobras
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table negocios enable row level security;
drop policy if exists "so membros" on negocios;
create policy "so membros" on negocios for all using (eh_membro()) with check (eh_membro());

-- Lançamento de um negócio: fica fora das contas da casa.
alter table lancamentos add column if not exists negocio_id uuid references negocios (id);
-- aluno, aluguel, fixa, variavel ou outra
alter table lancamentos add column if not exists grupo text;

-- Renda da casa que recebe as sobras do Espaço Soletti
insert into fontes_renda (nome, valor_bruto, percentual_imposto, conta_id)
select 'Espaço Soletti', null, 0, (select id from contas where nome = 'Sicredi')
where not exists (select 1 from fontes_renda where nome = 'Espaço Soletti');

insert into negocios (nome, fonte_id)
select 'Studio Pilates', (select id from fontes_renda where nome = 'Studio Pilates' limit 1)
on conflict (nome) do nothing;
insert into negocios (nome, fonte_id)
select 'Espaço Soletti', (select id from fontes_renda where nome = 'Espaço Soletti' limit 1)
on conflict (nome) do nothing;
