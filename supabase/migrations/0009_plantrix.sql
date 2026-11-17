-- Atualização 0009: Plantrix na seção Negócios + marcação "É da Plantrix".
-- Diferente do Studio e do Espaço, a Plantrix NÃO tem caixa separado:
-- a entrada cai no Mercado Pago do Diego e os gastos saem dos cartões da casa.
-- O lançamento marcado continua na fatura e no mês da casa, e também aparece
-- no painel da Plantrix para mostrar o resultado da empresa.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem problema.

-- Marcação: o lançamento é da casa, mas o gasto é da empresa.
alter table lancamentos add column if not exists marcado_negocio_id uuid references negocios (id) on delete set null;
create index if not exists lancamentos_marcado_negocio on lancamentos (marcado_negocio_id) where marcado_negocio_id is not null;

-- Negócio sem caixa próprio (só marcação) e as palavras que marcam sozinhas
alter table negocios add column if not exists so_marcacao boolean not null default false;
alter table negocios add column if not exists palavras_marcacao text[];

insert into negocios (nome, fonte_id, so_marcacao)
select 'Plantrix', (select id from fontes_renda where nome = 'Plantrix' limit 1), true
on conflict (nome) do update set so_marcacao = true, fonte_id = coalesce(negocios.fonte_id, excluded.fonte_id);

-- Contas da empresa (Diego, 10/11/2026): lançamento com essas palavras já vem marcado.
update negocios set palavras_marcacao = array['google', 'adobe', 'magnific', 'anthropic', 'contabilivre']
where nome = 'Plantrix' and palavras_marcacao is null;

-- Marca os gastos que já estão no sistema (YouTube fica de fora: é pessoal)
update lancamentos l set marcado_negocio_id = n.id
from negocios n
where n.nome = 'Plantrix' and l.tipo = 'saida' and l.marcado_negocio_id is null and l.negocio_id is null
  and l.descricao ~* '(google|adobe|magnific|anthropic|contabilivre)'
  and l.descricao !~* 'youtub';

-- Descontos mensais da Plantrix, retidos antes de o dinheiro chegar:
-- impostos das notas 6% (R$ 540 sobre 9.000) e INSS R$ 277,20. Líquido previsto: R$ 8.182,80.
update fontes_renda set valor_bruto = 9000, percentual_imposto = 6, descontos_fixos = 277.20
where nome = 'Plantrix';
