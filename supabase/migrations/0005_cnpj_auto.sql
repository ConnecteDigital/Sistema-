-- Robô de Prospecção — CNPJ automático na rodada + relatório "quem ligar"
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.
-- (Precisa do 0004_sites_leads.sql rodado antes.)

-- Progresso da etapa de CNPJ na rodada
alter table runs add column if not exists cnpj_total int not null default 0;
alter table runs add column if not exists cnpj_feitos int not null default 0;

-- Cache dos dados da Receita por CNPJ: o mesmo CNPJ não é consultado duas vezes
create table if not exists empresas_cnpj (
  cnpj           text primary key,          -- só dígitos
  dados          jsonb,                     -- null = CNPJ não encontrado na Receita
  consultado_em  timestamptz not null default now()
);
alter table empresas_cnpj enable row level security;

-- Lead: CNPJ e razão social à vista (para achar o mesmo dono em sites diferentes)
alter table leads add column if not exists cnpj text;
alter table leads add column if not exists razao_social text;
create index if not exists leads_cnpj_idx on leads(cnpj);

select 'ok' as cnpj_automatico;
