-- Robô de Prospecção — Fase 3 (sites, regras, leads) + Consulta de CNPJ
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

-- Verificação de site: motivo, CNPJs achados no site e resultado da tag do Google
alter table site_checks add column if not exists motivo text;
alter table site_checks add column if not exists cnpjs text[] not null default '{}';
alter table site_checks add column if not exists tag_google text
  check (tag_google in ('sim','so_gtm','nao','nao_verificado'));

-- Última verificação de cada anunciante
-- security_invoker: a view respeita o RLS (a chave pública continua sem ler nada)
create or replace view site_checks_recentes with (security_invoker = true) as
  select distinct on (advertiser_id) *
    from site_checks
   order by advertiser_id, verificado_em desc;
revoke all on site_checks_recentes from anon, authenticated;
grant select on site_checks_recentes to service_role;

-- Progresso da verificação de sites na rodada
alter table runs add column if not exists sites_total int not null default 0;
alter table runs add column if not exists sites_verificados int not null default 0;

-- Lead: resumo da última rodada em que apareceu
alter table leads add column if not exists forca text;
alter table leads add column if not exists presenca numeric;
alter table leads add column if not exists regioes text[] not null default '{}';
alter table leads add column if not exists ultima_rodada bigint references runs(id) on delete set null;
create index if not exists leads_prioridade_idx on leads(prioridade);

-- Consulta de CNPJ (botão), guardada para não consultar de novo
create table if not exists consultas_cnpj (
  advertiser_id  bigint primary key references advertisers(id) on delete cascade,
  resultado      jsonb not null,
  consultado_em  timestamptz not null default now()
);
alter table consultas_cnpj enable row level security;

select 'ok' as fase3;
