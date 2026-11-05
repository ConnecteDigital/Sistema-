-- Robô de Prospecção — "Outro site deste dono": consultar CNPJ de um domínio informado à mão
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

create table if not exists lead_dominios (
  id             bigint generated always as identity primary key,
  lead_id        bigint not null references leads(id) on delete cascade,
  dominio        text not null,
  resultado      jsonb,
  consultado_em  timestamptz not null default now(),
  unique (lead_id, dominio)
);
alter table lead_dominios enable row level security;

select 'ok' as outros_dominios;
