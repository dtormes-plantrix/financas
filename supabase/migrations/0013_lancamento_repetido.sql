-- Atualização 0013: aviso de lançamento repetido no WhatsApp.
-- Cole no SQL Editor do Supabase e clique em "Run". Pode rodar mais de uma vez.

-- Quando um recado parece repetir um lançamento, o WhatsApp pergunta "Lançar mesmo assim?"
-- e o lançamento fica guardado aqui até a pessoa responder Sim ou Não (um por número).
create table if not exists whatsapp_pendentes (
  telefone text primary key,
  registro jsonb not null,
  criado_em timestamptz not null default now()
);

-- Só o servidor (chave de serviço) mexe nesta tabela; o app não enxerga.
alter table whatsapp_pendentes enable row level security;
