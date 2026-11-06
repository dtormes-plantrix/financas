-- Atualização 0008: orçamento por categoria e categoria reconhecida pelo nome da loja.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem problema.

-- Quanto se quer gastar por mês em cada categoria (vazio = sem orçamento).
alter table categorias add column if not exists orcamento numeric(12, 2);

-- Nome da loja -> categoria. Ex.: "comper" -> Mercado.
-- Lançamento sem categoria cuja descrição tem esse texto entra na categoria.
create table if not exists regras_categoria (
  id uuid primary key default gen_random_uuid(),
  busca text not null unique,
  categoria_id uuid not null references categorias (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table regras_categoria enable row level security;
drop policy if exists "so membros" on regras_categoria;
create policy "so membros" on regras_categoria for all using (eh_membro()) with check (eh_membro());

-- "Restaurante e delivery" vira duas: "Bares e restaurantes" (com lanches, sorvete e café) e "Delivery".
update categorias set nome = 'Bares e restaurantes'
where nome = 'Restaurante e delivery'
  and grupo_id in (select id from grupos where negocio_id is null)
  and not exists (select 1 from categorias c join grupos g on g.id = c.grupo_id where g.negocio_id is null and c.nome = 'Bares e restaurantes');

insert into categorias (grupo_id, nome, ordem)
select c.grupo_id, 'Delivery', c.ordem
from categorias c join grupos g on g.id = c.grupo_id
where g.negocio_id is null and c.nome = 'Bares e restaurantes'
on conflict (grupo_id, nome) do nothing;

-- Orçamentos combinados com o Diego em 06/11/2026.
update categorias set orcamento = v.valor
from (values ('Mercado', 2000), ('Bares e restaurantes', 500), ('Delivery', 300)) as v (nome, valor), grupos g
where categorias.nome = v.nome and g.id = categorias.grupo_id and g.negocio_id is null
  and categorias.orcamento is null;

-- Nomes de loja que já sabemos a categoria.
insert into regras_categoria (busca, categoria_id)
select r.busca, c.id
from (values
  ('comper', 'Mercado'), ('supermercado', 'Mercado'), ('assai', 'Mercado'),
  ('acougue', 'Mercado'), ('padaria', 'Mercado'), ('panificadora', 'Mercado'),
  ('hortifruti', 'Mercado'), ('feira', 'Mercado'),
  ('ifood', 'Delivery'), ('rappi', 'Delivery'), ('aiqfome', 'Delivery'),
  ('pizz', 'Bares e restaurantes'), ('choper', 'Bares e restaurantes'), ('cervejaria', 'Bares e restaurantes'),
  ('restaurante', 'Bares e restaurantes'), ('lanche', 'Bares e restaurantes'), ('sorvet', 'Bares e restaurantes'),
  ('cafe', 'Bares e restaurantes'), ('bistro', 'Bares e restaurantes'), ('burger', 'Bares e restaurantes'),
  ('sushi', 'Bares e restaurantes'), ('churrasc', 'Bares e restaurantes'), ('boteco', 'Bares e restaurantes'),
  ('espetinho', 'Bares e restaurantes'), ('nevaska', 'Bares e restaurantes')
) as r (busca, categoria)
join categorias c on c.nome = r.categoria
join grupos g on g.id = c.grupo_id and g.negocio_id is null
on conflict (busca) do nothing;

-- Lançamentos da casa que estavam em "Restaurante e delivery" e são do iFood vão para Delivery.
update lancamentos l set categoria_id = d.id
from categorias d join grupos g on g.id = d.grupo_id and g.negocio_id is null
where d.nome = 'Delivery' and l.negocio_id is null
  and l.categoria_id in (select c.id from categorias c join grupos g2 on g2.id = c.grupo_id where g2.negocio_id is null and c.nome = 'Bares e restaurantes')
  and translate(lower(coalesce(l.descricao, '')), 'áàãâéêíóôõúç', 'aaaaeeiooouc') ~ '(ifood|rappi|aiqfome)';

-- Saídas da casa sem categoria recebem a categoria da regra (a de texto mais longo vence).
update lancamentos l set categoria_id = (
  select r.categoria_id from regras_categoria r
  where translate(lower(coalesce(l.descricao, '')), 'áàãâéêíóôõúç', 'aaaaeeiooouc') like '%' || r.busca || '%'
  order by length(r.busca) desc limit 1
)
where l.categoria_id is null and l.tipo = 'saida' and l.negocio_id is null
  and exists (
    select 1 from regras_categoria r
    where translate(lower(coalesce(l.descricao, '')), 'áàãâéêíóôõúç', 'aaaaeeiooouc') like '%' || r.busca || '%'
  );
