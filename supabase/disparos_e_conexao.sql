-- ROBÔ DE PROSPECÇÃO — DISPAROS (0009) + CONEXÃO DO WHATSAPP (0011), num arquivo só
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar mais de uma vez sem problema.

-- Robô de Prospecção — Disparos pelo WhatsApp (Cloud API oficial da Meta)
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

-- Contatos de WhatsApp: autorização (opt-in) e saída (opt-out) por número
create table if not exists wa_contatos (
  telefone        text primary key,                 -- E.164 sem "+": 5511987654321
  lead_id         bigint references leads(id) on delete set null,
  optin_em        timestamptz,
  optin_origem    text,                             -- 'ligacao' | 'whatsapp_manual' | 'respondeu' | 'formulario' | 'outro'
  optin_por       text,
  optout_em       timestamptz,                      -- pediu para sair: nunca mais recebe
  ultima_entrada  timestamptz,                      -- última mensagem recebida (janela de 24h para responder)
  criado_em       timestamptz not null default now()
);
create index if not exists wa_contatos_lead_idx on wa_contatos(lead_id);

-- Campanhas
create table if not exists wa_campanhas (
  id               bigint generated always as identity primary key,
  nome             text not null,
  modelo_nome      text not null,
  modelo_idioma    text not null default 'pt_BR',
  variaveis        jsonb not null default '[]',     -- ex.: ["empresa","problema"] na ordem {{1}}, {{2}}…
  filtro           jsonb not null default '{}',     -- { rodada, prioridades }
  status           text not null default 'pausada' check (status in ('enviando','pausada','concluida','cancelada')),
  ritmo_por_minuto int not null default 20,
  total            int not null default 0,
  erro             text,
  criado_em        timestamptz not null default now()
);

-- Um envio por contato da campanha
create table if not exists wa_envios (
  id            bigint generated always as identity primary key,
  campanha_id   bigint not null references wa_campanhas(id) on delete cascade,
  lead_id       bigint references leads(id) on delete set null,
  telefone      text not null,
  parametros    text[] not null default '{}',
  status        text not null default 'pendente'
                check (status in ('pendente','enviando','enviado','entregue','lido','respondido','falhou','ignorado')),
  wamid         text unique,
  erro          text,
  reservado_em  timestamptz,
  enviado_em    timestamptz,
  atualizado_em timestamptz not null default now(),
  unique (campanha_id, telefone)
);
create index if not exists wa_envios_campanha_idx on wa_envios(campanha_id, status);
create index if not exists wa_envios_enviado_idx on wa_envios(enviado_em);

-- Conversas (entrada e saída)
create table if not exists wa_mensagens (
  id         bigint generated always as identity primary key,
  telefone   text not null,
  lead_id    bigint references leads(id) on delete set null,
  direcao    text not null check (direcao in ('entrada','saida')),
  tipo       text,
  texto      text,
  wamid      text,
  status     text,
  criado_em  timestamptz not null default now(),
  bruto      jsonb
);
create index if not exists wa_mensagens_tel_idx on wa_mensagens(telefone, criado_em desc);
create unique index if not exists wa_mensagens_wamid_idx on wa_mensagens(wamid) where wamid is not null;

-- Reserva atômica de envios (mesma ideia das buscas: nunca manda duas vezes)
create or replace function reservar_envios(p_campanha bigint, p_limite int)
returns setof wa_envios
language sql
as $$
  update wa_envios e
     set status = 'enviando', reservado_em = now()
   where e.id in (
     select id from wa_envios
      where campanha_id = p_campanha
        and (status = 'pendente' or (status = 'enviando' and reservado_em < now() - interval '3 minutes' and wamid is null))
      order by id
      limit p_limite
      for update skip locked
   )
  returning e.*;
$$;
revoke all on function reservar_envios(bigint, int) from public, anon, authenticated;
grant execute on function reservar_envios(bigint, int) to service_role;

-- Configurações do disparo
insert into settings (chave, valor) values
  ('wa_limite_diario', '250'::jsonb),
  ('wa_ritmo_por_minuto', '20'::jsonb),
  ('wa_custo_marketing_usd', '0.0625'::jsonb)
on conflict (chave) do nothing;

do $$
declare t text;
begin
  foreach t in array array['wa_contatos','wa_campanhas','wa_envios','wa_mensagens'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

select 'ok' as disparos;

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
