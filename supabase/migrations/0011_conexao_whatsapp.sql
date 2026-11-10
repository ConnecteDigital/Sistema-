-- Robô de Prospecção — Conexão do WhatsApp por Embedded Signup (coexistência: mesmo número no app e na API)
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

create table if not exists wa_conexao (
  id                  bigint generated always as identity primary key,
  waba_id             text not null,
  phone_number_id     text not null,
  numero              text,
  nome                text,
  token_criptografado text not null,              -- token da empresa (Embedded Signup), criptografado pelo servidor
  coexistencia        boolean not null default true,
  ativo               boolean not null default true,
  conectado_em        timestamptz not null default now(),
  detalhes            jsonb
);
alter table wa_conexao enable row level security;

select 'ok' as conexao_whatsapp;
