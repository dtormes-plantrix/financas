-- Atualização 0014: relatório e avisos de orçamento pelo WhatsApp.
-- Cole no SQL Editor do Supabase e clique em "Run". Pode rodar mais de uma vez.

-- Quando cada pessoa escreveu por último para o número do WhatsApp.
-- A Meta só deixa o app mandar texto livre até 24h depois disso; fora disso, só modelo aprovado.
create table if not exists whatsapp_contatos (
  quem text primary key,             -- 'diego' ou 'jo'
  telefone text not null,            -- número como a Meta manda (wa_id)
  ultima_mensagem timestamptz not null default now()
);

-- O que já foi enviado (relatório do dia, aviso de 90% de uma categoria no mês), para não repetir.
create table if not exists avisos_enviados (
  chave text primary key,
  enviado_em timestamptz not null default now()
);

-- Só o servidor (chave de serviço) mexe nestas tabelas; o app não enxerga.
alter table whatsapp_contatos enable row level security;
alter table avisos_enviados enable row level security;
