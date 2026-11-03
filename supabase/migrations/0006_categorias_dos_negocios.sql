-- Atualização 0006: grupos e categorias próprios do Studio Pilates e do Espaço Soletti.
-- Ficam separados dos da casa e podem ser editados em Ajustes.
-- Pode rodar mais de uma vez sem problema.

-- Grupo com negócio = é daquele negócio. Grupo sem negócio = é da casa.
alter table grupos add column if not exists negocio_id uuid references negocios (id) on delete cascade;
alter table grupos drop constraint if exists grupos_nome_key;
drop index if exists grupos_negocio_nome;
create unique index grupos_negocio_nome on grupos (coalesce(negocio_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

-- Grupos sugeridos para cada negócio
insert into grupos (nome, ordem, negocio_id)
select g.nome, g.ordem, n.id
from (values
  ('Studio Pilates', 'Entradas', 1), ('Studio Pilates', 'Despesas fixas', 2), ('Studio Pilates', 'Despesas variáveis', 3),
  ('Espaço Soletti', 'Entradas', 1), ('Espaço Soletti', 'Despesas fixas', 2), ('Espaço Soletti', 'Despesas variáveis', 3)
) as g (negocio, nome, ordem)
join negocios n on n.nome = g.negocio
where not exists (select 1 from grupos x where x.negocio_id = n.id and x.nome = g.nome);

insert into categorias (grupo_id, nome, ordem)
select gr.id, c.nome, c.ordem
from (values
  ('Studio Pilates', 'Entradas', 'Mensalidades', 1), ('Studio Pilates', 'Entradas', 'Aulas avulsas', 2),
  ('Studio Pilates', 'Entradas', 'Pacotes e planos', 3),
  ('Studio Pilates', 'Despesas fixas', 'Aluguel da sala', 1), ('Studio Pilates', 'Despesas fixas', 'Energia, água e internet', 2),
  ('Studio Pilates', 'Despesas fixas', 'Instrutoras', 3), ('Studio Pilates', 'Despesas fixas', 'Contador e impostos', 4),
  ('Studio Pilates', 'Despesas fixas', 'Sistemas e assinaturas', 5),
  ('Studio Pilates', 'Despesas variáveis', 'Equipamentos', 1), ('Studio Pilates', 'Despesas variáveis', 'Material e limpeza', 2),
  ('Studio Pilates', 'Despesas variáveis', 'Manutenção', 3), ('Studio Pilates', 'Despesas variáveis', 'Divulgação', 4),
  ('Studio Pilates', 'Despesas variáveis', 'Cursos', 5),
  ('Espaço Soletti', 'Entradas', 'Aluguéis', 1), ('Espaço Soletti', 'Entradas', 'Locação por hora ou evento', 2),
  ('Espaço Soletti', 'Despesas fixas', 'Energia, água e internet', 1), ('Espaço Soletti', 'Despesas fixas', 'IPTU', 2),
  ('Espaço Soletti', 'Despesas fixas', 'Condomínio', 3), ('Espaço Soletti', 'Despesas fixas', 'Contador e impostos', 4),
  ('Espaço Soletti', 'Despesas variáveis', 'Manutenção', 1), ('Espaço Soletti', 'Despesas variáveis', 'Reformas', 2),
  ('Espaço Soletti', 'Despesas variáveis', 'Limpeza', 3), ('Espaço Soletti', 'Despesas variáveis', 'Divulgação', 4)
) as c (negocio, grupo, nome, ordem)
join negocios n on n.nome = c.negocio
join grupos gr on gr.negocio_id = n.id and gr.nome = c.grupo
on conflict (grupo_id, nome) do nothing;
