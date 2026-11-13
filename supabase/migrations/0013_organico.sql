-- 0013: Orgânico. Cada busca agora guarda também os resultados orgânicos (a mesma resposta da SerpApi,
-- sem gastar crédito a mais) e a análise mostra pago E orgânico de cada anunciante.
-- Banco que já existe: Supabase → SQL Editor → New query → colar → Run. Pode rodar de novo.

-- Quantos resultados orgânicos vieram na busca. NULL = orgânico não lido (rodadas antigas).
alter table run_searches add column if not exists qtd_organicos int;

create table if not exists organic_raw (
  id              bigint generated always as identity primary key,
  run_search_id   bigint not null references run_searches(id) on delete cascade,
  position        int,
  title           text,
  link            text,
  displayed_link  text,
  source          text,
  dominio         text
);
create index if not exists organic_raw_search_idx on organic_raw(run_search_id);
create index if not exists organic_raw_dominio_idx on organic_raw(dominio);
alter table organic_raw enable row level security;

-- Orgânico do anunciante na região. org_buscas NULL = não medido nesta rodada.
alter table run_advertisers add column if not exists org_buscas    int;
alter table run_advertisers add column if not exists org_aparicoes int;
alter table run_advertisers add column if not exists org_presenca  numeric;
alter table run_advertisers add column if not exists org_pos_media numeric;
alter table run_advertisers add column if not exists org_melhor_pos int;

select 'ok' as organico;
