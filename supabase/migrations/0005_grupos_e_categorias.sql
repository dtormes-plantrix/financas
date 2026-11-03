-- Atualização 0005: grupos de categorias (Casa > Mercado, Transporte > Combustível...).
-- Grupos e categorias podem ser criados, renomeados e apagados em Ajustes.
-- Pode rodar mais de uma vez sem problema.

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table grupos enable row level security;
drop policy if exists "so membros" on grupos;
create policy "so membros" on grupos for all using (eh_membro()) with check (eh_membro());

-- Cada categoria fica dentro de um grupo. Apagar o grupo apaga as categorias dele.
alter table categorias add column if not exists grupo_id uuid references grupos (id) on delete cascade;
alter table categorias add column if not exists ordem int not null default 0;
-- O mesmo nome pode existir em grupos diferentes (ex.: Manutenção da casa e do carro).
alter table categorias drop constraint if exists categorias_nome_key;
drop index if exists categorias_grupo_nome;
create unique index categorias_grupo_nome on categorias (grupo_id, nome);

-- Apagar uma categoria não apaga os lançamentos: eles só ficam sem categoria.
alter table lancamentos drop constraint if exists lancamentos_categoria_id_fkey;
alter table lancamentos add constraint lancamentos_categoria_id_fkey
  foreign key (categoria_id) references categorias (id) on delete set null;

-- Grupos sugeridos
insert into grupos (nome, ordem)
select g.nome, g.ordem
from (values
  ('Casa', 1), ('Filhos', 2), ('Estilo de vida', 3), ('Saúde', 4), ('Transporte', 5),
  ('Educação e trabalho', 6), ('Igreja e doações', 7), ('Banco e dívidas', 8),
  ('Investimentos', 9), ('Outros', 10)
) as g (nome, ordem)
where not exists (select 1 from grupos x where x.nome = g.nome);

-- As categorias que já existiam entram nos grupos (algumas com nome mais claro).
update categorias set nome = 'Contas da casa' where nome = 'Contas fixas' and grupo_id is null;
update categorias set nome = 'Manutenção' where nome = 'Casa' and grupo_id is null;
update categorias set nome = 'Consultas e exames' where nome = 'Saúde' and grupo_id is null;
update categorias set nome = 'Cursos e MBA' where nome = 'Educação' and grupo_id is null;
update categorias set nome = 'Combustível' where nome = 'Transporte' and grupo_id is null;

update categorias set grupo_id = (select id from grupos where nome = 'Casa')
  where grupo_id is null and nome in ('Mercado', 'Contas da casa', 'Manutenção', 'Assinaturas');
update categorias set grupo_id = (select id from grupos where nome = 'Estilo de vida')
  where grupo_id is null and nome in ('Restaurante e delivery', 'Lazer', 'Roupas');
update categorias set grupo_id = (select id from grupos where nome = 'Saúde')
  where grupo_id is null and nome = 'Consultas e exames';
update categorias set grupo_id = (select id from grupos where nome = 'Educação e trabalho')
  where grupo_id is null and nome = 'Cursos e MBA';
update categorias set grupo_id = (select id from grupos where nome = 'Transporte')
  where grupo_id is null and nome = 'Combustível';
update categorias set grupo_id = (select id from grupos where nome = 'Outros')
  where grupo_id is null;

-- Categorias novas
insert into categorias (grupo_id, nome, ordem)
select g.id, c.nome, c.ordem
from (values
  ('Casa', 'Mercado', 1), ('Casa', 'Contas da casa', 2), ('Casa', 'Condomínio', 3),
  ('Casa', 'Manutenção', 4), ('Casa', 'Assinaturas', 5), ('Casa', 'Eletro e móveis', 6),
  ('Filhos', 'Escola', 1), ('Filhos', 'Esportes', 2), ('Filhos', 'Mesada', 3),
  ('Estilo de vida', 'Restaurante e delivery', 1), ('Estilo de vida', 'Compras', 2),
  ('Estilo de vida', 'Roupas', 3), ('Estilo de vida', 'Cuidados pessoais', 4),
  ('Estilo de vida', 'Lazer', 5), ('Estilo de vida', 'Viagens', 6), ('Estilo de vida', 'Presentes', 7),
  ('Saúde', 'Farmácia', 1), ('Saúde', 'Consultas e exames', 2), ('Saúde', 'Seguros', 3),
  ('Transporte', 'Combustível', 1), ('Transporte', 'Pedágio e estacionamento', 2),
  ('Transporte', 'Manutenção do carro', 3), ('Transporte', 'IPVA e Detran', 4), ('Transporte', 'Uber e táxi', 5),
  ('Educação e trabalho', 'Cursos e MBA', 1), ('Educação e trabalho', 'Ferramentas e softwares', 2),
  ('Igreja e doações', 'Dízimo', 1), ('Igreja e doações', 'Ofertas', 2), ('Igreja e doações', 'Doações e associações', 3),
  ('Banco e dívidas', 'Juros e IOF', 1), ('Banco e dívidas', 'Tarifas', 2), ('Banco e dívidas', 'Empréstimos', 3),
  ('Investimentos', 'Previdência', 1), ('Investimentos', 'Poupança', 2),
  ('Outros', 'Outros', 1)
) as c (grupo, nome, ordem)
join grupos g on g.nome = c.grupo
on conflict (grupo_id, nome) do update set ordem = excluded.ordem;
