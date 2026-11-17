-- Atualização 0010: lançamentos que chegam pelo WhatsApp.
-- Cole no SQL Editor do Supabase e clique em "Run". Pode rodar mais de uma vez.

-- Guarda o código do recado do WhatsApp que criou o lançamento.
-- Serve para não lançar duas vezes o mesmo recado e para o "desfaz" achar o último.
alter table lancamentos add column if not exists whatsapp_id text;
create unique index if not exists lancamentos_whatsapp_id on lancamentos (whatsapp_id) where whatsapp_id is not null;
