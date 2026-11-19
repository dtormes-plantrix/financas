-- Atualização 0010: Microsoft 365 também é da Plantrix (Diego, 19/11/2026).
-- Google One e Contabilivre já entram pela 0009 ("google" e "contabilivre").
-- Rode depois da 0009. Pode rodar mais de uma vez sem problema.

update negocios
set palavras_marcacao = array_append(coalesce(palavras_marcacao, '{}'), 'microsoft')
where nome = 'Plantrix' and not ('microsoft' = any (coalesce(palavras_marcacao, '{}')));

update lancamentos l set marcado_negocio_id = n.id
from negocios n
where n.nome = 'Plantrix' and l.tipo = 'saida' and l.marcado_negocio_id is null and l.negocio_id is null
  and l.descricao ~* 'microsoft';
