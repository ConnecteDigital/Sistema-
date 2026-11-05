-- Robô de Prospecção — Conta do Google Ads do anunciante (Central de Transparência via DataForSEO)
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

create table if not exists contas_google_ads (
  advertiser_id   bigint primary key references advertisers(id) on delete cascade,
  task_dominio    text,                 -- tarefa 1: anúncios do domínio → descobre a conta
  task_conta      text,                 -- tarefa 2: tudo que a conta anuncia → outros sites
  status          text not null default 'pendente' check (status in ('pendente','pronta','erro')),
  resultado       jsonb,                -- resumo: contas, nomes verificados, outros sites
  bruto           jsonb,                -- resposta original (para conferência)
  erro            text,
  consultado_em   timestamptz not null default now()
);
alter table contas_google_ads enable row level security;

select 'ok' as conta_google_ads;
