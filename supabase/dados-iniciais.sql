-- FINANÇAS · dados iniciais
-- Rode depois de 0001_inicial.sql e depois de criar os dois usuários
-- (Authentication > Users > Add user). Troque os e-mails abaixo.

insert into membros (user_id, nome, apelido)
select id, 'Diego', 'diego' from auth.users where email = 'EMAIL_DO_DIEGO';

insert into membros (user_id, nome, apelido)
select id, 'Jô', 'jo' from auth.users where email = 'EMAIL_DA_JO';

-- Contas (das conversas e extratos de setembro e outubro de 2026)
insert into contas (nome, dono, limite_cheque_especial) values
  ('Mercado Pago', 'diego', null),
  ('Sicredi', 'jo', 20000);

-- Cartões (das faturas de outubro de 2026)
insert into cartoes (nome, dono, limite, dia_fechamento, dia_vencimento, conta_pagamento_id) values
  ('Mercado Pago', 'diego', 16000, 5, 13, (select id from contas where nome = 'Mercado Pago')),
  ('Sicredi Visa Gold', 'jo', 25000, 28, 13, (select id from contas where nome = 'Sicredi')),
  ('Nubank', 'jo', 48316.49, 20, 27, null);

-- Rendas
insert into fontes_renda (nome, valor_bruto, percentual_imposto, dia_previsto, conta_id) values
  ('Plantrix', 9000, 6, null, (select id from contas where nome = 'Mercado Pago')),
  ('Aluguel', 8692.33, 0, 20, (select id from contas where nome = 'Sicredi')),
  ('Ajuda do Sady', 10638, 0, 5, (select id from contas where nome = 'Sicredi')),
  ('Studio Pilates', null, 0, null, (select id from contas where nome = 'Sicredi'));

-- Categorias (opcionais no lançamento)
insert into categorias (nome) values
  ('Mercado'), ('Casa'), ('Contas fixas'), ('Saúde'), ('Educação'), ('Transporte'),
  ('Restaurante e delivery'), ('Lazer'), ('Roupas'), ('Assinaturas'), ('Outros');
