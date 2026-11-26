-- Importar OFX: guarda o código de cada transação do banco (FITID) no lançamento,
-- para o mesmo arquivo (ou um arquivo com período repetido) nunca lançar duas vezes.
-- Pode rodar mais de uma vez sem problema.
alter table lancamentos add column if not exists id_banco text;
create index if not exists lancamentos_id_banco on lancamentos (id_banco) where id_banco is not null;
