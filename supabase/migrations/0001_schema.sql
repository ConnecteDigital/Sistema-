-- Robô de Prospecção — esquema (seção 12 do PLANO, rev. 1: sem login)
-- Rodar no Supabase: SQL Editor → New query → colar → Run.
-- Pode rodar de novo sem quebrar (usa IF NOT EXISTS).

-- ---------------------------------------------------------------------------
-- Equipe (substitui profiles: não há usuários logados)
-- ---------------------------------------------------------------------------
create table if not exists equipe (
  id          bigint generated always as identity primary key,
  nome        text not null unique,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chaves da SerpApi (criptografadas pelo servidor com KEYS_ENCRYPTION_SECRET)
-- ---------------------------------------------------------------------------
create table if not exists serp_keys (
  id                    bigint generated always as identity primary key,
  apelido               text not null,
  chave_criptografada   text not null,
  chave_final           text not null,            -- últimos 4 caracteres, só para exibir
  ativa                 boolean not null default true,
  limite_troca          int not null default 2,
  creditos_restantes    int,
  buscas_por_mes        int,
  uso_mes               int,
  limite_por_hora       int,
  plano                 text,
  erro                  text,
  verificada_em         timestamptz,
  criado_em             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catálogo de regiões e pontos
-- ---------------------------------------------------------------------------
create table if not exists regions (
  id         bigint generated always as identity primary key,
  nome       text not null unique,
  uf         text not null,
  ddd        text not null,
  descricao  text,
  ordem      int not null default 0
);

create table if not exists locations (
  id                 bigint generated always as identity primary key,
  region_id          bigint not null references regions(id) on delete cascade,
  nome_exibicao      text not null,
  serpapi_canonical  text not null,
  tipo               text not null check (tipo in ('City','District','Neighborhood','Municipality')),
  camada             text not null check (camada in ('minima','media','ampla')),
  ddd_esperado       text not null,
  ativo              boolean not null default true,
  validado_em        timestamptz,              -- null = ainda não conferido no locations.json
  unique (region_id, serpapi_canonical)
);
create index if not exists locations_region_idx on locations(region_id);

-- ---------------------------------------------------------------------------
-- Variações de palavra-chave
-- ---------------------------------------------------------------------------
create table if not exists niches (
  id     bigint generated always as identity primary key,
  nome   text not null unique,
  ordem  int not null default 0
);

create table if not exists keyword_templates (
  id        bigint generated always as identity primary key,
  niche_id  bigint not null references niches(id) on delete cascade,
  modelo    text not null,
  ordem     int not null default 0,
  unique (niche_id, modelo)
);

-- ---------------------------------------------------------------------------
-- Rodadas e buscas
-- ---------------------------------------------------------------------------
create table if not exists runs (
  id                bigint generated always as identity primary key,
  criado_em         timestamptz not null default now(),
  origem            text not null default 'manual' check (origem in ('manual','agendada')),
  termos            text[] not null default '{}',
  status            text not null default 'pendente'
                    check (status in ('pendente','buscando','verificando','pronta','erro')),
  total_buscas      int not null default 0,
  buscas_ok         int not null default 0,
  creditos_usados   int not null default 0,
  comando_original  text,
  schedule_id       bigint
);

create table if not exists run_searches (
  id              bigint generated always as identity primary key,
  run_id          bigint not null references runs(id) on delete cascade,
  location_id     bigint not null references locations(id),
  termo           text not null,
  status          text not null default 'pendente' check (status in ('pendente','ok','erro')),
  serp_key_id     bigint references serp_keys(id) on delete set null,
  executada_em    timestamptz,
  location_usada  text,
  qtd_anuncios    int,
  tentativas      int not null default 0,
  erro            text,
  unique (run_id, location_id, termo)
);
create index if not exists run_searches_run_status_idx on run_searches(run_id, status);

create table if not exists ads_raw (
  id              bigint generated always as identity primary key,
  run_search_id   bigint not null references run_searches(id) on delete cascade,
  position        int,
  block_position  text,
  title           text,
  link            text,
  displayed_link  text,
  source          text,
  dominio         text,
  sitelinks       jsonb,
  extensions      jsonb,
  rating          numeric,
  reviews         int,
  tracking_link   text
);
create index if not exists ads_raw_search_idx on ads_raw(run_search_id);
create index if not exists ads_raw_dominio_idx on ads_raw(dominio);

-- ---------------------------------------------------------------------------
-- Anunciantes e agregação por rodada/região
-- ---------------------------------------------------------------------------
create table if not exists advertisers (
  id             bigint generated always as identity primary key,
  dominio        text not null unique,
  nome           text,
  primeiro_visto timestamptz not null default now(),
  ultimo_visto   timestamptz not null default now()
);

create table if not exists run_advertisers (
  id             bigint generated always as identity primary key,
  run_id         bigint not null references runs(id) on delete cascade,
  region_id      bigint not null references regions(id),
  advertiser_id  bigint not null references advertisers(id) on delete cascade,
  aparicoes      int not null,
  buscas         int not null,
  presenca       numeric not null,
  pontos         text[] not null default '{}',
  termos         text[] not null default '{}',
  pos_media      numeric,
  pct_topo       numeric,
  pct_sitelinks  numeric,
  titulo         text,
  link           text,
  forca          text check (forca in ('Fraca','Média','Forte')),
  unique (run_id, region_id, advertiser_id)
);

-- ---------------------------------------------------------------------------
-- Verificação de site
-- ---------------------------------------------------------------------------
create table if not exists site_checks (
  id             bigint generated always as identity primary key,
  advertiser_id  bigint not null references advertisers(id) on delete cascade,
  url            text not null,
  verificado_em  timestamptz not null default now(),
  http_status    int,
  url_final      text,
  situacao       text check (situacao in ('ok','fora_do_ar','suspenso','dns','bloqueado','nao_verificado')),
  telefones      text[] not null default '{}',
  whatsapps      text[] not null default '{}',
  tags_aw        text[] not null default '{}',
  tags_gtm       text[] not null default '{}',
  ga4            text[] not null default '{}',
  tamanho_html   int,
  tempo_ms       int,
  via            text not null default 'proprio' check (via in ('proprio','dataforseo'))
);
create index if not exists site_checks_adv_idx on site_checks(advertiser_id, verificado_em desc);

-- ---------------------------------------------------------------------------
-- Leads (CRM)
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id                  bigint generated always as identity primary key,
  advertiser_id       bigint not null unique references advertisers(id) on delete cascade,
  prioridade          text check (prioridade in ('Máxima','Alta','Normal','Baixa')),
  telefone_principal  text,
  outros_telefones    text[] not null default '{}',
  observacoes         text[] not null default '{}',
  status              text not null default 'A contatar' check (status in (
                        'A contatar','Contatado','Respondeu','Reunião marcada',
                        'Proposta enviada','Fechado','Sem interesse','Descartado')),
  responsavel_id      bigint references equipe(id) on delete set null,
  data_contato        date,
  notas               text,
  atualizado_em       timestamptz not null default now()
);

create table if not exists lead_events (
  id         bigint generated always as identity primary key,
  lead_id    bigint not null references leads(id) on delete cascade,
  autor      text,
  tipo       text not null,
  texto      text,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Exclusões, agendamentos e configurações
-- ---------------------------------------------------------------------------
create table if not exists blocklist (
  id      bigint generated always as identity primary key,
  dominio text not null unique,
  motivo  text
);

create table if not exists schedules (
  id            bigint generated always as identity primary key,
  nome          text not null,
  cron          text not null,
  termos        text[] not null default '{}',
  location_ids  bigint[] not null default '{}',
  ativo         boolean not null default true
);

create table if not exists settings (
  chave  text primary key,
  valor  jsonb not null
);

-- ---------------------------------------------------------------------------
-- Segurança: RLS ligado em tudo e NENHUMA política.
-- A chave pública (publishable/anon) não lê nem grava nada.
-- Só o servidor do Next.js, com a chave secreta, acessa o banco.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'equipe','serp_keys','regions','locations','niches','keyword_templates','runs',
    'run_searches','ads_raw','advertisers','run_advertisers','site_checks','leads',
    'lead_events','blocklist','schedules','settings'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
