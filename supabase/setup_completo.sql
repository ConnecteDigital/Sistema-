-- ROBÔ DE PROSPECÇÃO — SCRIPT ÚNICO PARA O SUPABASE (instalação do zero)
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

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

-- Robô de Prospecção — dados iniciais (apêndice A, seção 6, seção 10).
-- GERADO por scripts/gerar-seed.mjs. Rodar DEPOIS do 0001_schema.sql. Pode rodar de novo.
-- Pontos com validado_em = null ainda não foram conferidos na SerpApi:
-- use o botão "Validar locais" em Configurações (grátis).

insert into regions (nome, uf, ddd, descricao, ordem) values ('011 Capital', 'SP', '11', 'São Paulo capital por zonas/distritos', 0)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Consolação (Centro)', 'Consolacao,State of Sao Paulo,Brazil', 'District', 'minima', '11', now()),
  ('Tatuapé (Leste)', 'Tatuape,State of Sao Paulo,Brazil', 'District', 'minima', '11', now()),
  ('Santana (Norte)', 'Santana,State of Sao Paulo,Brazil', 'District', 'minima', '11', now()),
  ('Lapa (Oeste)', 'Lapa,State of Sao Paulo,Brazil', 'District', 'minima', '11', now()),
  ('Santo Amaro (Sul)', 'Santo Amaro,State of Sao Paulo,Brazil', 'District', 'minima', '11', now()),
  ('Mooca', 'Mooca,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Penha', 'Penha,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Itaquera', 'Itaquera,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('São Miguel Paulista', 'Sao Miguel Paulista,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Tucuruvi', 'Tucuruvi,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Freguesia do Ó', 'Freguesia do O,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Butantã', 'Butanta,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Vila Mariana', 'Vila Mariana,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Ipiranga', 'Ipiranga,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Jabaquara', 'Jabaquara,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Campo Limpo', 'Campo Limpo,State of Sao Paulo,Brazil', 'District', 'media', '11', now()),
  ('Bom Retiro', 'Bom Retiro,State of Sao Paulo,Brazil', 'District', 'ampla', '11', now()),
  ('Guaianases', 'Guaianases,State of Sao Paulo,Brazil', 'District', 'ampla', '11', now()),
  ('Vila Maria', 'Vila Maria,State of Sao Paulo,Brazil', 'District', 'ampla', '11', now()),
  ('Pinheiros', 'Pinheiros,State of Sao Paulo,Brazil', 'District', 'ampla', '11', now()),
  ('Capão Redondo', 'Capao Redondo,State of Sao Paulo,Brazil', 'District', 'ampla', '11', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '011 Capital'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('011 ABC', 'SP', '11', 'Grande ABC', 1)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Santo André', 'Santo Andre,State of Sao Paulo,Brazil', 'City', 'minima', '11', now()),
  ('São Bernardo do Campo', 'Sao Bernardo do Campo,State of Sao Paulo,Brazil', 'City', 'minima', '11', now()),
  ('São Caetano do Sul', 'Sao Caetano do Sul,State of Sao Paulo,Brazil', 'City', 'media', '11', now()),
  ('Diadema', 'Diadema,State of Sao Paulo,Brazil', 'City', 'media', '11', now()),
  ('Mauá', 'Maua,State of Sao Paulo,Brazil', 'City', 'media', '11', now()),
  ('Ribeirão Pires', 'Ribeirao Pires,State of Sao Paulo,Brazil', 'City', 'ampla', '11', now()),
  ('Rio Grande da Serra', 'Rio Grande da Serra,State of Sao Paulo,Brazil', 'City', 'ampla', '11', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '011 ABC'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('011 Grande SP', 'SP', '11', 'Guarulhos, Osasco e região', 2)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Guarulhos', 'Guarulhos,State of Sao Paulo,Brazil', 'City', 'minima', '11', now()),
  ('Osasco', 'Osasco,Osasco,State of Sao Paulo,Brazil', 'City', 'minima', '11', now()),
  ('Barueri', 'Barueri,State of Sao Paulo,Brazil', 'City', 'media', '11', null::timestamptz),
  ('Carapicuíba', 'Carapicuiba,State of Sao Paulo,Brazil', 'City', 'media', '11', null::timestamptz),
  ('Mogi das Cruzes', 'Mogi das Cruzes,State of Sao Paulo,Brazil', 'City', 'media', '11', null::timestamptz),
  ('Taboão da Serra', 'Taboao da Serra,State of Sao Paulo,Brazil', 'City', 'ampla', '11', null::timestamptz),
  ('Cotia', 'Cotia,State of Sao Paulo,Brazil', 'City', 'ampla', '11', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '011 Grande SP'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('012 São José dos Campos', 'SP', '12', 'Vale do Paraíba', 3)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('São José dos Campos', 'Sao Jose dos Campos,State of Sao Paulo,Brazil', 'City', 'minima', '12', now()),
  ('Taubaté', 'Taubate,State of Sao Paulo,Brazil', 'City', 'media', '12', null::timestamptz),
  ('Jacareí', 'Jacarei,State of Sao Paulo,Brazil', 'City', 'media', '12', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '012 São José dos Campos'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('013 Baixada Santista', 'SP', '13', 'Litoral de SP', 4)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Santos', 'Santos,State of Sao Paulo,Brazil', 'City', 'minima', '13', null::timestamptz),
  ('São Vicente', 'Sao Vicente,State of Sao Paulo,Brazil', 'City', 'minima', '13', null::timestamptz),
  ('Praia Grande', 'Praia Grande,State of Sao Paulo,Brazil', 'City', 'media', '13', null::timestamptz),
  ('Guarujá', 'Guaruja,State of Sao Paulo,Brazil', 'City', 'media', '13', null::timestamptz),
  ('Cubatão', 'Cubatao,State of Sao Paulo,Brazil', 'City', 'ampla', '13', null::timestamptz),
  ('Itanhaém', 'Itanhaem,State of Sao Paulo,Brazil', 'City', 'ampla', '13', null::timestamptz),
  ('Mongaguá', 'Mongagua,State of Sao Paulo,Brazil', 'City', 'ampla', '13', null::timestamptz),
  ('Bertioga', 'Bertioga,State of Sao Paulo,Brazil', 'City', 'ampla', '13', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '013 Baixada Santista'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('014 Bauru e Marília', 'SP', '14', 'Centro-oeste paulista', 5)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Bauru', 'Bauru,State of Sao Paulo,Brazil', 'City', 'minima', '14', null::timestamptz),
  ('Marília', 'Marilia,State of Sao Paulo,Brazil', 'City', 'minima', '14', null::timestamptz),
  ('Jaú', 'Jau,State of Sao Paulo,Brazil', 'City', 'media', '14', null::timestamptz),
  ('Botucatu', 'Botucatu,State of Sao Paulo,Brazil', 'City', 'media', '14', null::timestamptz),
  ('Ourinhos', 'Ourinhos,State of Sao Paulo,Brazil', 'City', 'media', '14', null::timestamptz),
  ('Lins', 'Lins,State of Sao Paulo,Brazil', 'City', 'ampla', '14', null::timestamptz),
  ('Avaré', 'Avare,State of Sao Paulo,Brazil', 'City', 'ampla', '14', null::timestamptz),
  ('Lençóis Paulista', 'Lencois Paulista,State of Sao Paulo,Brazil', 'City', 'ampla', '14', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '014 Bauru e Marília'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('015 Sorocaba e região', 'SP', '15', 'Sorocaba e sudoeste paulista', 6)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Sorocaba', 'Sorocaba,State of Sao Paulo,Brazil', 'City', 'minima', '15', null::timestamptz),
  ('Votorantim', 'Votorantim,State of Sao Paulo,Brazil', 'City', 'media', '15', null::timestamptz),
  ('Itapetininga', 'Itapetininga,State of Sao Paulo,Brazil', 'City', 'media', '15', null::timestamptz),
  ('Tatuí', 'Tatui,State of Sao Paulo,Brazil', 'City', 'media', '15', null::timestamptz),
  ('Itapeva', 'Itapeva,State of Sao Paulo,Brazil', 'City', 'ampla', '15', null::timestamptz),
  ('Boituva', 'Boituva,State of Sao Paulo,Brazil', 'City', 'ampla', '15', null::timestamptz),
  ('Porto Feliz', 'Porto Feliz,State of Sao Paulo,Brazil', 'City', 'ampla', '15', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '015 Sorocaba e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('019 Campinas e região', 'SP', '19', 'Cidades grandes do 019', 7)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Campinas', 'Campinas,State of Sao Paulo,Brazil', 'City', 'minima', '19', now()),
  ('Piracicaba', 'Piracicaba,State of Sao Paulo,Brazil', 'City', 'minima', '19', null::timestamptz),
  ('Sumaré', 'Sumare,State of Sao Paulo,Brazil', 'City', 'media', '19', null::timestamptz),
  ('Americana', 'Americana,State of Sao Paulo,Brazil', 'City', 'media', '19', null::timestamptz),
  ('Limeira', 'Limeira,State of Sao Paulo,Brazil', 'City', 'media', '19', null::timestamptz),
  ('Indaiatuba', 'Indaiatuba,State of Sao Paulo,Brazil', 'City', 'media', '19', null::timestamptz),
  ('Hortolândia', 'Hortolandia,State of Sao Paulo,Brazil', 'City', 'ampla', '19', null::timestamptz),
  ('Valinhos', 'Valinhos,State of Sao Paulo,Brazil', 'City', 'ampla', '19', null::timestamptz),
  ('Rio Claro', 'Rio Claro,State of Sao Paulo,Brazil', 'City', 'ampla', '19', null::timestamptz),
  ('Santa Bárbara d''Oeste', 'Santa Barbara d''Oeste,State of Sao Paulo,Brazil', 'City', 'ampla', '19', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '019 Campinas e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('016 Ribeirão Preto e região', 'SP', '16', 'Cidades grandes do 016', 8)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Ribeirão Preto', 'Ribeirao Preto,State of Sao Paulo,Brazil', 'City', 'minima', '16', null::timestamptz),
  ('Araraquara', 'Araraquara,State of Sao Paulo,Brazil', 'City', 'media', '16', null::timestamptz),
  ('São Carlos', 'Sao Carlos,State of Sao Paulo,Brazil', 'City', 'media', '16', null::timestamptz),
  ('Franca', 'Franca,State of Sao Paulo,Brazil', 'City', 'media', '16', null::timestamptz),
  ('Sertãozinho', 'Sertaozinho,State of Sao Paulo,Brazil', 'City', 'ampla', '16', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '016 Ribeirão Preto e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('017 São José do Rio Preto e região', 'SP', '17', 'Noroeste paulista', 9)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('São José do Rio Preto', 'Sao Jose do Rio Preto,State of Sao Paulo,Brazil', 'City', 'minima', '17', null::timestamptz),
  ('Catanduva', 'Catanduva,State of Sao Paulo,Brazil', 'City', 'media', '17', null::timestamptz),
  ('Barretos', 'Barretos,State of Sao Paulo,Brazil', 'City', 'media', '17', null::timestamptz),
  ('Votuporanga', 'Votuporanga,State of Sao Paulo,Brazil', 'City', 'media', '17', null::timestamptz),
  ('Mirassol', 'Mirassol,State of Sao Paulo,Brazil', 'City', 'ampla', '17', null::timestamptz),
  ('Fernandópolis', 'Fernandopolis,State of Sao Paulo,Brazil', 'City', 'ampla', '17', null::timestamptz),
  ('Bebedouro', 'Bebedouro,State of Sao Paulo,Brazil', 'City', 'ampla', '17', null::timestamptz),
  ('Jales', 'Jales,State of Sao Paulo,Brazil', 'City', 'ampla', '17', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '017 São José do Rio Preto e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('018 Presidente Prudente e Araçatuba', 'SP', '18', 'Oeste paulista', 10)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Presidente Prudente', 'Presidente Prudente,State of Sao Paulo,Brazil', 'City', 'minima', '18', null::timestamptz),
  ('Araçatuba', 'Aracatuba,State of Sao Paulo,Brazil', 'City', 'minima', '18', null::timestamptz),
  ('Birigui', 'Birigui,State of Sao Paulo,Brazil', 'City', 'media', '18', null::timestamptz),
  ('Assis', 'Assis,State of Sao Paulo,Brazil', 'City', 'media', '18', null::timestamptz),
  ('Andradina', 'Andradina,State of Sao Paulo,Brazil', 'City', 'media', '18', null::timestamptz),
  ('Penápolis', 'Penapolis,State of Sao Paulo,Brazil', 'City', 'ampla', '18', null::timestamptz),
  ('Adamantina', 'Adamantina,State of Sao Paulo,Brazil', 'City', 'ampla', '18', null::timestamptz),
  ('Dracena', 'Dracena,State of Sao Paulo,Brazil', 'City', 'ampla', '18', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '018 Presidente Prudente e Araçatuba'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('041 Curitiba e região', 'PR', '41', 'Curitiba e região metropolitana', 11)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Curitiba', 'Curitiba,State of Parana,Brazil', 'City', 'minima', '41', now()),
  ('São José dos Pinhais', 'Sao Jose dos Pinhais,State of Parana,Brazil', 'City', 'media', '41', now()),
  ('Colombo', 'Colombo,State of Parana,Brazil', 'City', 'media', '41', now()),
  ('Araucária', 'Araucaria,State of Parana,Brazil', 'City', 'ampla', '41', now()),
  ('Pinhais', 'Pinhais,State of Parana,Brazil', 'City', 'ampla', '41', now()),
  ('Almirante Tamandaré', 'Almirante Tamandare,State of Parana,Brazil', 'City', 'ampla', '41', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '041 Curitiba e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('048 Florianópolis e região', 'SC', '48', 'Grande Florianópolis', 12)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Florianópolis', 'Florianopolis,State of Santa Catarina,Brazil', 'City', 'minima', '48', now()),
  ('São José', 'Sao Jose,State of Santa Catarina,Brazil', 'City', 'media', '48', now()),
  ('Palhoça', 'Palhoca,State of Santa Catarina,Brazil', 'City', 'ampla', '48', now()),
  ('Biguaçu', 'Biguacu,State of Santa Catarina,Brazil', 'City', 'ampla', '48', now()),
  ('Jurerê', 'Jurere,State of Santa Catarina,Brazil', 'Neighborhood', 'ampla', '48', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '048 Florianópolis e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('047 Joinville e Blumenau', 'SC', '47', 'Norte de SC e Vale do Itajaí', 13)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Joinville', 'Joinville,State of Santa Catarina,Brazil', 'City', 'minima', '47', null::timestamptz),
  ('Blumenau', 'Blumenau,State of Santa Catarina,Brazil', 'City', 'minima', '47', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '047 Joinville e Blumenau'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('047 Balneário Camboriú e região', 'SC', '47', 'Litoral norte de SC', 14)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Balneário Camboriú', 'Balneario Camboriu,State of Santa Catarina,Brazil', 'City', 'minima', '47', now()),
  ('Itajaí', 'Itajai,State of Santa Catarina,Brazil', 'City', 'media', '47', now()),
  ('Camboriú', 'Camboriu,State of Santa Catarina,Brazil', 'City', 'ampla', '47', now()),
  ('Itapema', 'Itapema,State of Santa Catarina,Brazil', 'City', 'ampla', '47', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '047 Balneário Camboriú e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('061 Distrito Federal', 'DF', '61', 'Brasília e regiões administrativas', 15)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Brasília', 'Brasilia,Federal District,Brazil', 'City', 'minima', '61', now()),
  ('Taguatinga', 'Taguatinga, Federal District,Federal District,Brazil', 'District', 'minima', '61', now()),
  ('Águas Claras', 'Aguas Claras, Federal District,Federal District,Brazil', 'District', 'media', '61', now()),
  ('Samambaia', 'Samambaia,Federal District,Brazil', 'District', 'media', '61', now()),
  ('Asa Sul', 'Asa Sul,Federal District,Brazil', 'District', 'media', '61', now()),
  ('Sobradinho', 'Sobradinho,Federal District,Brazil', 'District', 'ampla', '61', now()),
  ('Planaltina', 'Planaltina,Federal District,Brazil', 'District', 'ampla', '61', now()),
  ('Santa Maria', 'Santa Maria,Federal District,Brazil', 'District', 'ampla', '61', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '061 Distrito Federal'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('062 Goiânia e região', 'GO', '62', 'Grande Goiânia', 16)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Goiânia', 'Goiania,State of Goias,Brazil', 'City', 'minima', '62', now()),
  ('Aparecida de Goiânia', 'Aparecida de Goiania,State of Goias,Brazil', 'City', 'media', '62', now()),
  ('Anápolis', 'Anapolis,State of Goias,Brazil', 'City', 'media', '62', null::timestamptz),
  ('Senador Canedo', 'Senador Canedo,State of Goias,Brazil', 'City', 'ampla', '62', now()),
  ('Trindade', 'Trindade,State of Goias,Brazil', 'City', 'ampla', '62', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '062 Goiânia e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('065 Cuiabá e região', 'MT', '65', 'Cuiabá e Várzea Grande', 17)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Cuiabá', 'Cuiaba,State of Mato Grosso,Brazil', 'City', 'minima', '65', now()),
  ('Várzea Grande', 'Varzea Grande,State of Mato Grosso,Brazil', 'City', 'media', '65', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '065 Cuiabá e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('068 Rio Branco e região', 'AC', '68', 'Capital de AC e cidades próximas', 18)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Rio Branco', 'Rio Branco,State of Acre,Brazil', 'City', 'minima', '68', null::timestamptz),
  ('Cruzeiro do Sul', 'Cruzeiro do Sul,State of Acre,Brazil', 'City', 'media', '68', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '068 Rio Branco e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('082 Maceió e região', 'AL', '82', 'Capital de AL e cidades próximas', 19)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Maceió', 'Maceio,State of Alagoas,Brazil', 'City', 'minima', '82', null::timestamptz),
  ('Arapiraca', 'Arapiraca,State of Alagoas,Brazil', 'City', 'media', '82', null::timestamptz),
  ('Rio Largo', 'Rio Largo,State of Alagoas,Brazil', 'City', 'media', '82', null::timestamptz),
  ('Marechal Deodoro', 'Marechal Deodoro,State of Alagoas,Brazil', 'City', 'ampla', '82', null::timestamptz),
  ('Palmeira dos Índios', 'Palmeira dos Indios,State of Alagoas,Brazil', 'City', 'ampla', '82', null::timestamptz),
  ('São Miguel dos Campos', 'Sao Miguel dos Campos,State of Alagoas,Brazil', 'City', 'ampla', '82', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '082 Maceió e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('096 Macapá e região', 'AP', '96', 'Capital de AP e cidades próximas', 20)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Macapá', 'Macapa,State of Amapa,Brazil', 'City', 'minima', '96', null::timestamptz),
  ('Santana', 'Santana,State of Amapa,Brazil', 'City', 'media', '96', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '096 Macapá e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('092 Manaus e região', 'AM', '92', 'Capital de AM e cidades próximas', 21)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Manaus', 'Manaus,State of Amazonas,Brazil', 'City', 'minima', '92', null::timestamptz),
  ('Manacapuru', 'Manacapuru,State of Amazonas,Brazil', 'City', 'media', '92', null::timestamptz),
  ('Itacoatiara', 'Itacoatiara,State of Amazonas,Brazil', 'City', 'media', '92', null::timestamptz),
  ('Parintins', 'Parintins,State of Amazonas,Brazil', 'City', 'ampla', '92', null::timestamptz),
  ('Coari', 'Coari,State of Amazonas,Brazil', 'City', 'ampla', '97', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '092 Manaus e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('071 Salvador e região', 'BA', '71', 'Capital de BA e cidades próximas', 22)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Salvador', 'Salvador,State of Bahia,Brazil', 'City', 'minima', '71', null::timestamptz),
  ('Lauro de Freitas', 'Lauro de Freitas,State of Bahia,Brazil', 'City', 'media', '71', null::timestamptz),
  ('Camaçari', 'Camacari,State of Bahia,Brazil', 'City', 'media', '71', null::timestamptz),
  ('Feira de Santana', 'Feira de Santana,State of Bahia,Brazil', 'City', 'media', '75', null::timestamptz),
  ('Simões Filho', 'Simoes Filho,State of Bahia,Brazil', 'City', 'ampla', '71', null::timestamptz),
  ('Candeias', 'Candeias,State of Bahia,Brazil', 'City', 'ampla', '71', null::timestamptz),
  ('Dias d''Ávila', 'Dias d''Avila,State of Bahia,Brazil', 'City', 'ampla', '71', null::timestamptz),
  ('Vitória da Conquista', 'Vitoria da Conquista,State of Bahia,Brazil', 'City', 'ampla', '77', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '071 Salvador e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('085 Fortaleza e região', 'CE', '85', 'Capital de CE e cidades próximas', 23)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Fortaleza', 'Fortaleza,State of Ceara,Brazil', 'City', 'minima', '85', null::timestamptz),
  ('Caucaia', 'Caucaia,State of Ceara,Brazil', 'City', 'media', '85', null::timestamptz),
  ('Maracanaú', 'Maracanau,State of Ceara,Brazil', 'City', 'media', '85', null::timestamptz),
  ('Maranguape', 'Maranguape,State of Ceara,Brazil', 'City', 'ampla', '85', null::timestamptz),
  ('Eusébio', 'Eusebio,State of Ceara,Brazil', 'City', 'ampla', '85', null::timestamptz),
  ('Aquiraz', 'Aquiraz,State of Ceara,Brazil', 'City', 'ampla', '85', null::timestamptz),
  ('Juazeiro do Norte', 'Juazeiro do Norte,State of Ceara,Brazil', 'City', 'ampla', '88', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '085 Fortaleza e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('027 Vitória e região', 'ES', '27', 'Capital de ES e cidades próximas', 24)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Vitória', 'Vitoria,State of Espirito Santo,Brazil', 'City', 'minima', '27', null::timestamptz),
  ('Vila Velha', 'Vila Velha,State of Espirito Santo,Brazil', 'City', 'media', '27', null::timestamptz),
  ('Serra', 'Serra,State of Espirito Santo,Brazil', 'City', 'media', '27', null::timestamptz),
  ('Cariacica', 'Cariacica,State of Espirito Santo,Brazil', 'City', 'media', '27', null::timestamptz),
  ('Guarapari', 'Guarapari,State of Espirito Santo,Brazil', 'City', 'ampla', '27', null::timestamptz),
  ('Viana', 'Viana,State of Espirito Santo,Brazil', 'City', 'ampla', '27', null::timestamptz),
  ('Linhares', 'Linhares,State of Espirito Santo,Brazil', 'City', 'ampla', '27', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '027 Vitória e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('098 São Luís e região', 'MA', '98', 'Capital de MA e cidades próximas', 25)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('São Luís', 'Sao Luis,State of Maranhao,Brazil', 'City', 'minima', '98', null::timestamptz),
  ('São José de Ribamar', 'Sao Jose de Ribamar,State of Maranhao,Brazil', 'City', 'media', '98', null::timestamptz),
  ('Paço do Lumiar', 'Paco do Lumiar,State of Maranhao,Brazil', 'City', 'media', '98', null::timestamptz),
  ('Imperatriz', 'Imperatriz,State of Maranhao,Brazil', 'City', 'ampla', '99', null::timestamptz),
  ('Timon', 'Timon,State of Maranhao,Brazil', 'City', 'ampla', '99', null::timestamptz),
  ('Caxias', 'Caxias,State of Maranhao,Brazil', 'City', 'ampla', '99', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '098 São Luís e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('067 Campo Grande e região', 'MS', '67', 'Capital de MS e cidades próximas', 26)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Campo Grande', 'Campo Grande,State of Mato Grosso do Sul,Brazil', 'City', 'minima', '67', null::timestamptz),
  ('Dourados', 'Dourados,State of Mato Grosso do Sul,Brazil', 'City', 'media', '67', null::timestamptz),
  ('Três Lagoas', 'Tres Lagoas,State of Mato Grosso do Sul,Brazil', 'City', 'ampla', '67', null::timestamptz),
  ('Corumbá', 'Corumba,State of Mato Grosso do Sul,Brazil', 'City', 'ampla', '67', null::timestamptz),
  ('Ponta Porã', 'Ponta Pora,State of Mato Grosso do Sul,Brazil', 'City', 'ampla', '67', null::timestamptz),
  ('Sidrolândia', 'Sidrolandia,State of Mato Grosso do Sul,Brazil', 'City', 'ampla', '67', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '067 Campo Grande e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('031 Belo Horizonte e região', 'MG', '31', 'Capital de MG e cidades próximas', 27)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Belo Horizonte', 'Belo Horizonte,State of Minas Gerais,Brazil', 'City', 'minima', '31', null::timestamptz),
  ('Contagem', 'Contagem,State of Minas Gerais,Brazil', 'City', 'media', '31', null::timestamptz),
  ('Betim', 'Betim,State of Minas Gerais,Brazil', 'City', 'media', '31', null::timestamptz),
  ('Nova Lima', 'Nova Lima,State of Minas Gerais,Brazil', 'City', 'ampla', '31', null::timestamptz),
  ('Ribeirão das Neves', 'Ribeirao das Neves,State of Minas Gerais,Brazil', 'City', 'ampla', '31', null::timestamptz),
  ('Santa Luzia', 'Santa Luzia,State of Minas Gerais,Brazil', 'City', 'ampla', '31', null::timestamptz),
  ('Sete Lagoas', 'Sete Lagoas,State of Minas Gerais,Brazil', 'City', 'ampla', '31', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '031 Belo Horizonte e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('091 Belém e região', 'PA', '91', 'Capital de PA e cidades próximas', 28)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Belém', 'Belem,State of Para,Brazil', 'City', 'minima', '91', null::timestamptz),
  ('Ananindeua', 'Ananindeua,State of Para,Brazil', 'City', 'media', '91', null::timestamptz),
  ('Marituba', 'Marituba,State of Para,Brazil', 'City', 'media', '91', null::timestamptz),
  ('Castanhal', 'Castanhal,State of Para,Brazil', 'City', 'ampla', '91', null::timestamptz),
  ('Santa Izabel do Pará', 'Santa Izabel do Para,State of Para,Brazil', 'City', 'ampla', '91', null::timestamptz),
  ('Abaetetuba', 'Abaetetuba,State of Para,Brazil', 'City', 'ampla', '91', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '091 Belém e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('083 João Pessoa e região', 'PB', '83', 'Capital de PB e cidades próximas', 29)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('João Pessoa', 'Joao Pessoa,State of Paraiba,Brazil', 'City', 'minima', '83', null::timestamptz),
  ('Campina Grande', 'Campina Grande,State of Paraiba,Brazil', 'City', 'media', '83', null::timestamptz),
  ('Santa Rita', 'Santa Rita,State of Paraiba,Brazil', 'City', 'media', '83', null::timestamptz),
  ('Bayeux', 'Bayeux,State of Paraiba,Brazil', 'City', 'media', '83', null::timestamptz),
  ('Cabedelo', 'Cabedelo,State of Paraiba,Brazil', 'City', 'ampla', '83', null::timestamptz),
  ('Patos', 'Patos,State of Paraiba,Brazil', 'City', 'ampla', '83', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '083 João Pessoa e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('081 Recife e região', 'PE', '81', 'Capital de PE e cidades próximas', 30)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Recife', 'Recife,State of Pernambuco,Brazil', 'City', 'minima', '81', null::timestamptz),
  ('Jaboatão dos Guararapes', 'Jaboatao dos Guararapes,State of Pernambuco,Brazil', 'City', 'media', '81', null::timestamptz),
  ('Olinda', 'Olinda,State of Pernambuco,Brazil', 'City', 'media', '81', null::timestamptz),
  ('Paulista', 'Paulista,State of Pernambuco,Brazil', 'City', 'media', '81', null::timestamptz),
  ('Camaragibe', 'Camaragibe,State of Pernambuco,Brazil', 'City', 'ampla', '81', null::timestamptz),
  ('Cabo de Santo Agostinho', 'Cabo de Santo Agostinho,State of Pernambuco,Brazil', 'City', 'ampla', '81', null::timestamptz),
  ('Caruaru', 'Caruaru,State of Pernambuco,Brazil', 'City', 'ampla', '81', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '081 Recife e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('086 Teresina e região', 'PI', '86', 'Capital de PI e cidades próximas', 31)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Teresina', 'Teresina,State of Piaui,Brazil', 'City', 'minima', '86', null::timestamptz),
  ('Parnaíba', 'Parnaiba,State of Piaui,Brazil', 'City', 'media', '86', null::timestamptz),
  ('Picos', 'Picos,State of Piaui,Brazil', 'City', 'ampla', '89', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '086 Teresina e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('021 Rio de Janeiro e região', 'RJ', '21', 'Capital de RJ e cidades próximas', 32)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Rio de Janeiro', 'Rio de Janeiro,State of Rio de Janeiro,Brazil', 'City', 'minima', '21', null::timestamptz),
  ('Niterói', 'Niteroi,State of Rio de Janeiro,Brazil', 'City', 'media', '21', null::timestamptz),
  ('São Gonçalo', 'Sao Goncalo,State of Rio de Janeiro,Brazil', 'City', 'media', '21', null::timestamptz),
  ('Duque de Caxias', 'Duque de Caxias,State of Rio de Janeiro,Brazil', 'City', 'media', '21', null::timestamptz),
  ('Nova Iguaçu', 'Nova Iguacu,State of Rio de Janeiro,Brazil', 'City', 'media', '21', null::timestamptz),
  ('Belford Roxo', 'Belford Roxo,State of Rio de Janeiro,Brazil', 'City', 'ampla', '21', null::timestamptz),
  ('São João de Meriti', 'Sao Joao de Meriti,State of Rio de Janeiro,Brazil', 'City', 'ampla', '21', null::timestamptz),
  ('Petrópolis', 'Petropolis,State of Rio de Janeiro,Brazil', 'City', 'ampla', '24', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '021 Rio de Janeiro e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('084 Natal e região', 'RN', '84', 'Capital de RN e cidades próximas', 33)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Natal', 'Natal,State of Rio Grande do Norte,Brazil', 'City', 'minima', '84', null::timestamptz),
  ('Parnamirim', 'Parnamirim,State of Rio Grande do Norte,Brazil', 'City', 'media', '84', null::timestamptz),
  ('Mossoró', 'Mossoro,State of Rio Grande do Norte,Brazil', 'City', 'media', '84', null::timestamptz),
  ('São Gonçalo do Amarante', 'Sao Goncalo do Amarante,State of Rio Grande do Norte,Brazil', 'City', 'ampla', '84', null::timestamptz),
  ('Macaíba', 'Macaiba,State of Rio Grande do Norte,Brazil', 'City', 'ampla', '84', null::timestamptz),
  ('Extremoz', 'Extremoz,State of Rio Grande do Norte,Brazil', 'City', 'ampla', '84', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '084 Natal e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('051 Porto Alegre e região', 'RS', '51', 'Capital de RS e cidades próximas', 34)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Porto Alegre', 'Porto Alegre,State of Rio Grande do Sul,Brazil', 'City', 'minima', '51', null::timestamptz),
  ('Canoas', 'Canoas,State of Rio Grande do Sul,Brazil', 'City', 'media', '51', null::timestamptz),
  ('Gravataí', 'Gravatai,State of Rio Grande do Sul,Brazil', 'City', 'media', '51', null::timestamptz),
  ('Novo Hamburgo', 'Novo Hamburgo,State of Rio Grande do Sul,Brazil', 'City', 'media', '51', null::timestamptz),
  ('São Leopoldo', 'Sao Leopoldo,State of Rio Grande do Sul,Brazil', 'City', 'ampla', '51', null::timestamptz),
  ('Viamão', 'Viamao,State of Rio Grande do Sul,Brazil', 'City', 'ampla', '51', null::timestamptz),
  ('Alvorada', 'Alvorada,State of Rio Grande do Sul,Brazil', 'City', 'ampla', '51', null::timestamptz),
  ('Caxias do Sul', 'Caxias do Sul,State of Rio Grande do Sul,Brazil', 'City', 'ampla', '54', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '051 Porto Alegre e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('069 Porto Velho e região', 'RO', '69', 'Capital de RO e cidades próximas', 35)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Porto Velho', 'Porto Velho,State of Rondonia,Brazil', 'City', 'minima', '69', null::timestamptz),
  ('Ji-Paraná', 'Ji-Parana,State of Rondonia,Brazil', 'City', 'media', '69', null::timestamptz),
  ('Ariquemes', 'Ariquemes,State of Rondonia,Brazil', 'City', 'media', '69', null::timestamptz),
  ('Vilhena', 'Vilhena,State of Rondonia,Brazil', 'City', 'ampla', '69', null::timestamptz),
  ('Cacoal', 'Cacoal,State of Rondonia,Brazil', 'City', 'ampla', '69', null::timestamptz),
  ('Jaru', 'Jaru,State of Rondonia,Brazil', 'City', 'ampla', '69', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '069 Porto Velho e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('095 Boa Vista e região', 'RR', '95', 'Capital de RR e cidades próximas', 36)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Boa Vista', 'Boa Vista,State of Roraima,Brazil', 'City', 'minima', '95', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '095 Boa Vista e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('079 Aracaju e região', 'SE', '79', 'Capital de SE e cidades próximas', 37)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Aracaju', 'Aracaju,State of Sergipe,Brazil', 'City', 'minima', '79', null::timestamptz),
  ('Nossa Senhora do Socorro', 'Nossa Senhora do Socorro,State of Sergipe,Brazil', 'City', 'media', '79', null::timestamptz),
  ('São Cristóvão', 'Sao Cristovao,State of Sergipe,Brazil', 'City', 'media', '79', null::timestamptz),
  ('Itabaiana', 'Itabaiana,State of Sergipe,Brazil', 'City', 'ampla', '79', null::timestamptz),
  ('Lagarto', 'Lagarto,State of Sergipe,Brazil', 'City', 'ampla', '79', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '079 Aracaju e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('063 Palmas e região', 'TO', '63', 'Capital de TO e cidades próximas', 38)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Palmas', 'Palmas,State of Tocantins,Brazil', 'City', 'minima', '63', null::timestamptz),
  ('Araguaína', 'Araguaina,State of Tocantins,Brazil', 'City', 'media', '63', null::timestamptz),
  ('Gurupi', 'Gurupi,State of Tocantins,Brazil', 'City', 'media', '63', null::timestamptz),
  ('Porto Nacional', 'Porto Nacional,State of Tocantins,Brazil', 'City', 'ampla', '63', null::timestamptz),
  ('Paraíso do Tocantins', 'Paraiso do Tocantins,State of Tocantins,Brazil', 'City', 'ampla', '63', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '063 Palmas e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into niches (nome, ordem) values ('Desentupidora', 0) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('{termo}', 0),
  ('{termo} 24 horas', 1),
  ('{termo} perto de mim', 2),
  ('{termo} mais próxima', 3),
  ('desentupimento', 4),
  ('desentupir esgoto', 5),
  ('desentupidora de vaso', 6)
) as v(modelo, ordem) where n.nome = 'Desentupidora'
on conflict (niche_id, modelo) do nothing;

insert into niches (nome, ordem) values ('Encanador', 1) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('{termo}', 0),
  ('{termo} 24 horas', 1),
  ('{termo} perto de mim', 2),
  ('{termo} mais próximo', 3),
  ('{termo} emergência', 4),
  ('serviços hidráulicos', 5),
  ('caça vazamento', 6)
) as v(modelo, ordem) where n.nome = 'Encanador'
on conflict (niche_id, modelo) do nothing;

insert into niches (nome, ordem) values ('Eletricista', 2) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('{termo}', 0),
  ('{termo} 24 horas', 1),
  ('{termo} perto de mim', 2),
  ('{termo} residencial', 3),
  ('{termo} emergência', 4)
) as v(modelo, ordem) where n.nome = 'Eletricista'
on conflict (niche_id, modelo) do nothing;

insert into niches (nome, ordem) values ('Serralheiro', 3) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('{termo}', 0),
  ('serralheria', 1),
  ('serralheria perto de mim', 2),
  ('{termo} 24 horas', 3)
) as v(modelo, ordem) where n.nome = 'Serralheiro'
on conflict (niche_id, modelo) do nothing;

insert into niches (nome, ordem) values ('Caça vazamento', 4) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('{termo}', 0),
  ('caça vazamento 24 horas', 1),
  ('detecção de vazamento', 2),
  ('vazamento de água', 3)
) as v(modelo, ordem) where n.nome = 'Caça vazamento'
on conflict (niche_id, modelo) do nothing;

insert into niches (nome, ordem) values ('Limpa fossa', 5) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('{termo}', 0),
  ('limpa fossa 24 horas', 1),
  ('limpeza de fossa', 2),
  ('caminhão limpa fossa', 3)
) as v(modelo, ordem) where n.nome = 'Limpa fossa'
on conflict (niche_id, modelo) do nothing;

insert into blocklist (dominio, motivo) values
  ('getninjas.com.br', 'Marketplace de serviços'),
  ('portoseguro.com.br', 'Seguradora'),
  ('habitissimo.com.br', 'Marketplace de serviços'),
  ('mercadolivre.com.br', 'Marketplace'),
  ('olx.com.br', 'Classificados'),
  ('google.com', 'Google')
on conflict (dominio) do nothing;

insert into settings (chave, valor) values ('forca_limites', '{"fraca_ate":0.4,"forte_acima":0.75}'::jsonb) on conflict (chave) do nothing;
insert into settings (chave, valor) values ('troca_chave_limite', '2'::jsonb) on conflict (chave) do nothing;
insert into settings (chave, valor) values ('buscas_em_paralelo', '6'::jsonb) on conflict (chave) do nothing;
insert into settings (chave, valor) values ('reverificar_site_dias', '7'::jsonb) on conflict (chave) do nothing;

insert into equipe (nome) values ('Gabriel') on conflict (nome) do nothing;

-- Robô de Prospecção — Fase 2 (motor de busca)
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

-- Rodada: guarda mensagem de erro (ex.: créditos acabaram no meio)
alter table runs add column if not exists erro text;
alter table runs add column if not exists finalizada_em timestamptz;

-- Busca: novo estado "executando" (reservada por um lote) e horário da reserva
alter table run_searches drop constraint if exists run_searches_status_check;
alter table run_searches add constraint run_searches_status_check
  check (status in ('pendente','executando','ok','erro'));
alter table run_searches add column if not exists reservada_em timestamptz;

-- Agregação: quantas buscas tiveram o mesmo domínio 2x (possíveis duas contas)
alter table run_advertisers add column if not exists duplicado_mesma_busca int not null default 0;
alter table run_advertisers add column if not exists nome text;

-- Reserva atômica de buscas para um lote. Evita que duas abas/execuções
-- façam a mesma busca (e gastem crédito duas vezes). Buscas "executando"
-- há mais de 3 minutos (lote que caiu) voltam a ser reservadas.
create or replace function reservar_buscas(p_run_id bigint, p_limite int)
returns setof run_searches
language sql
as $$
  update run_searches s
     set status = 'executando', reservada_em = now()
   where s.id in (
     select id from run_searches
      where run_id = p_run_id
        and (status = 'pendente'
             or (status = 'executando' and reservada_em < now() - interval '3 minutes'))
      order by id
      limit p_limite
      for update skip locked
   )
  returning s.*;
$$;

-- Só o servidor (chave secreta) pode chamar
revoke all on function reservar_buscas(bigint, int) from public, anon, authenticated;
grant execute on function reservar_buscas(bigint, int) to service_role;

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

-- Robô de Prospecção — Relatórios + "anunciando na palavra-chave errada"
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.
-- (Precisa do 0004 e do 0005 rodados antes.)

-- Texto visível do site (até 50 mil caracteres) para saber do que o site fala
alter table site_checks add column if not exists texto text;
alter table site_checks add column if not exists texto_len int;

-- Recria a view para incluir as colunas novas
drop view if exists site_checks_recentes;
create view site_checks_recentes with (security_invoker = true) as
  select distinct on (advertiser_id) *
    from site_checks
   order by advertiser_id, verificado_em desc;
revoke all on site_checks_recentes from anon, authenticated;
grant select on site_checks_recentes to service_role;

-- Por rodada: o site fala da palavra que ele anunciou?
alter table run_advertisers add column if not exists termo_no_site boolean;      -- null = não deu para verificar
alter table run_advertisers add column if not exists termos_ausentes text[] not null default '{}';

select 'ok' as relatorios;

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

-- Robô de Prospecção — Agendamentos (repetir rodadas em horários fixos)
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

alter table schedules alter column cron drop not null;
alter table schedules add column if not exists horarios     text[] not null default '{}';          -- ex.: {'08:00','13:00','17:00'} (horário de Brasília)
alter table schedules add column if not exists dias         int[]  not null default '{1,2,3,4,5}'; -- 0=domingo … 6=sábado
alter table schedules add column if not exists rodada_origem bigint references runs(id) on delete set null;
alter table schedules add column if not exists ultimos      jsonb  not null default '{}';          -- {"2026-11-05 13:00": 12} já disparados
alter table schedules add column if not exists ultimo_erro  text;
alter table schedules add column if not exists criado_em    timestamptz not null default now();

select 'ok' as agendamentos;

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

-- Robô de Prospecção — novas regiões do interior de SP: DDD 014, 015 e 017.
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.
-- Não apaga nada. Depois, em Configurações, clique em "Validar locais" (grátis).

update regions set ordem = 0 where nome = '011 Capital';
update regions set ordem = 1 where nome = '011 ABC';
update regions set ordem = 2 where nome = '011 Grande SP';
update regions set ordem = 3 where nome = '012 São José dos Campos';
update regions set ordem = 4 where nome = '013 Baixada Santista';

insert into regions (nome, uf, ddd, descricao, ordem) values ('014 Bauru e Marília', 'SP', '14', 'Centro-oeste paulista', 5)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Bauru', 'Bauru,State of Sao Paulo,Brazil', 'City', 'minima', '14', null::timestamptz),
  ('Marília', 'Marilia,State of Sao Paulo,Brazil', 'City', 'minima', '14', null::timestamptz),
  ('Jaú', 'Jau,State of Sao Paulo,Brazil', 'City', 'media', '14', null::timestamptz),
  ('Botucatu', 'Botucatu,State of Sao Paulo,Brazil', 'City', 'media', '14', null::timestamptz),
  ('Ourinhos', 'Ourinhos,State of Sao Paulo,Brazil', 'City', 'media', '14', null::timestamptz),
  ('Lins', 'Lins,State of Sao Paulo,Brazil', 'City', 'ampla', '14', null::timestamptz),
  ('Avaré', 'Avare,State of Sao Paulo,Brazil', 'City', 'ampla', '14', null::timestamptz),
  ('Lençóis Paulista', 'Lencois Paulista,State of Sao Paulo,Brazil', 'City', 'ampla', '14', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '014 Bauru e Marília'
on conflict (region_id, serpapi_canonical) do nothing;


insert into regions (nome, uf, ddd, descricao, ordem) values ('015 Sorocaba e região', 'SP', '15', 'Sorocaba e sudoeste paulista', 6)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Sorocaba', 'Sorocaba,State of Sao Paulo,Brazil', 'City', 'minima', '15', null::timestamptz),
  ('Votorantim', 'Votorantim,State of Sao Paulo,Brazil', 'City', 'media', '15', null::timestamptz),
  ('Itapetininga', 'Itapetininga,State of Sao Paulo,Brazil', 'City', 'media', '15', null::timestamptz),
  ('Tatuí', 'Tatui,State of Sao Paulo,Brazil', 'City', 'media', '15', null::timestamptz),
  ('Itapeva', 'Itapeva,State of Sao Paulo,Brazil', 'City', 'ampla', '15', null::timestamptz),
  ('Boituva', 'Boituva,State of Sao Paulo,Brazil', 'City', 'ampla', '15', null::timestamptz),
  ('Porto Feliz', 'Porto Feliz,State of Sao Paulo,Brazil', 'City', 'ampla', '15', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '015 Sorocaba e região'
on conflict (region_id, serpapi_canonical) do nothing;

update regions set ordem = 7 where nome = '019 Campinas e região';
update regions set ordem = 8 where nome = '016 Ribeirão Preto e região';

insert into regions (nome, uf, ddd, descricao, ordem) values ('017 São José do Rio Preto e região', 'SP', '17', 'Noroeste paulista', 9)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('São José do Rio Preto', 'Sao Jose do Rio Preto,State of Sao Paulo,Brazil', 'City', 'minima', '17', null::timestamptz),
  ('Catanduva', 'Catanduva,State of Sao Paulo,Brazil', 'City', 'media', '17', null::timestamptz),
  ('Barretos', 'Barretos,State of Sao Paulo,Brazil', 'City', 'media', '17', null::timestamptz),
  ('Votuporanga', 'Votuporanga,State of Sao Paulo,Brazil', 'City', 'media', '17', null::timestamptz),
  ('Mirassol', 'Mirassol,State of Sao Paulo,Brazil', 'City', 'ampla', '17', null::timestamptz),
  ('Fernandópolis', 'Fernandopolis,State of Sao Paulo,Brazil', 'City', 'ampla', '17', null::timestamptz),
  ('Bebedouro', 'Bebedouro,State of Sao Paulo,Brazil', 'City', 'ampla', '17', null::timestamptz),
  ('Jales', 'Jales,State of Sao Paulo,Brazil', 'City', 'ampla', '17', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '017 São José do Rio Preto e região'
on conflict (region_id, serpapi_canonical) do nothing;

update regions set ordem = 10 where nome = '018 Presidente Prudente e Araçatuba';
update regions set ordem = 11 where nome = '041 Curitiba e região';
update regions set ordem = 12 where nome = '048 Florianópolis e região';
update regions set ordem = 13 where nome = '047 Joinville e Blumenau';
update regions set ordem = 14 where nome = '047 Balneário Camboriú e região';
update regions set ordem = 15 where nome = '061 Distrito Federal';
update regions set ordem = 16 where nome = '062 Goiânia e região';
update regions set ordem = 17 where nome = '065 Cuiabá e região';
update regions set ordem = 18 where nome = '068 Rio Branco e região';
update regions set ordem = 19 where nome = '082 Maceió e região';
update regions set ordem = 20 where nome = '096 Macapá e região';
update regions set ordem = 21 where nome = '092 Manaus e região';
update regions set ordem = 22 where nome = '071 Salvador e região';
update regions set ordem = 23 where nome = '085 Fortaleza e região';
update regions set ordem = 24 where nome = '027 Vitória e região';
update regions set ordem = 25 where nome = '098 São Luís e região';
update regions set ordem = 26 where nome = '067 Campo Grande e região';
update regions set ordem = 27 where nome = '031 Belo Horizonte e região';
update regions set ordem = 28 where nome = '091 Belém e região';
update regions set ordem = 29 where nome = '083 João Pessoa e região';
update regions set ordem = 30 where nome = '081 Recife e região';
update regions set ordem = 31 where nome = '086 Teresina e região';
update regions set ordem = 32 where nome = '021 Rio de Janeiro e região';
update regions set ordem = 33 where nome = '084 Natal e região';
update regions set ordem = 34 where nome = '051 Porto Alegre e região';
update regions set ordem = 35 where nome = '069 Porto Velho e região';
update regions set ordem = 36 where nome = '095 Boa Vista e região';
update regions set ordem = 37 where nome = '079 Aracaju e região';
update regions set ordem = 38 where nome = '063 Palmas e região';
select r.nome, count(l.id) as cidades from regions r left join locations l on l.region_id = r.id
 where r.ddd in ('14','15','17') group by r.nome order by r.nome;

-- 0012: Santa Catarina — Joinville, Blumenau (nova região "047 Joinville e Blumenau") e Jurerê (Florianópolis).
-- Banco que já existe: Supabase → SQL Editor → New query → colar → Run. Pode rodar de novo.
-- Depois: Configurações → "Validar locais pendentes na SerpApi (grátis)".

insert into regions (nome, uf, ddd, descricao, ordem) values ('047 Joinville e Blumenau', 'SC', '47', 'Norte de SC e Vale do Itajaí', 9)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Joinville', 'Joinville,State of Santa Catarina,Brazil', 'City', 'minima', '47', null::timestamptz),
  ('Blumenau', 'Blumenau,State of Santa Catarina,Brazil', 'City', 'minima', '47', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '047 Joinville e Blumenau'
on conflict (region_id, serpapi_canonical) do nothing;

insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, 'Jurerê', 'Jurere,State of Santa Catarina,Brazil', 'Neighborhood', 'ampla', '48', null::timestamptz
from regions r where r.nome = '048 Florianópolis e região'
on conflict (region_id, serpapi_canonical) do nothing;

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

-- Robô de Prospecção — nova região do oeste de SP: DDD 018.
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.
-- Não apaga nada. Depois, em Configurações, clique em "Validar locais" (grátis).

update regions set ordem = 0 where nome = '011 Capital';
update regions set ordem = 1 where nome = '011 ABC';
update regions set ordem = 2 where nome = '011 Grande SP';
update regions set ordem = 3 where nome = '012 São José dos Campos';
update regions set ordem = 4 where nome = '013 Baixada Santista';
update regions set ordem = 5 where nome = '014 Bauru e Marília';
update regions set ordem = 6 where nome = '015 Sorocaba e região';
update regions set ordem = 7 where nome = '019 Campinas e região';
update regions set ordem = 8 where nome = '016 Ribeirão Preto e região';
update regions set ordem = 9 where nome = '017 São José do Rio Preto e região';

insert into regions (nome, uf, ddd, descricao, ordem) values ('018 Presidente Prudente e Araçatuba', 'SP', '18', 'Oeste paulista', 10)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Presidente Prudente', 'Presidente Prudente,State of Sao Paulo,Brazil', 'City', 'minima', '18', null::timestamptz),
  ('Araçatuba', 'Aracatuba,State of Sao Paulo,Brazil', 'City', 'minima', '18', null::timestamptz),
  ('Birigui', 'Birigui,State of Sao Paulo,Brazil', 'City', 'media', '18', null::timestamptz),
  ('Assis', 'Assis,State of Sao Paulo,Brazil', 'City', 'media', '18', null::timestamptz),
  ('Andradina', 'Andradina,State of Sao Paulo,Brazil', 'City', 'media', '18', null::timestamptz),
  ('Penápolis', 'Penapolis,State of Sao Paulo,Brazil', 'City', 'ampla', '18', null::timestamptz),
  ('Adamantina', 'Adamantina,State of Sao Paulo,Brazil', 'City', 'ampla', '18', null::timestamptz),
  ('Dracena', 'Dracena,State of Sao Paulo,Brazil', 'City', 'ampla', '18', null::timestamptz)
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '018 Presidente Prudente e Araçatuba'
on conflict (region_id, serpapi_canonical) do nothing;

update regions set ordem = 11 where nome = '041 Curitiba e região';
update regions set ordem = 12 where nome = '048 Florianópolis e região';
update regions set ordem = 13 where nome = '047 Joinville e Blumenau';
update regions set ordem = 14 where nome = '047 Balneário Camboriú e região';
update regions set ordem = 15 where nome = '061 Distrito Federal';
update regions set ordem = 16 where nome = '062 Goiânia e região';
update regions set ordem = 17 where nome = '065 Cuiabá e região';
update regions set ordem = 18 where nome = '068 Rio Branco e região';
update regions set ordem = 19 where nome = '082 Maceió e região';
update regions set ordem = 20 where nome = '096 Macapá e região';
update regions set ordem = 21 where nome = '092 Manaus e região';
update regions set ordem = 22 where nome = '071 Salvador e região';
update regions set ordem = 23 where nome = '085 Fortaleza e região';
update regions set ordem = 24 where nome = '027 Vitória e região';
update regions set ordem = 25 where nome = '098 São Luís e região';
update regions set ordem = 26 where nome = '067 Campo Grande e região';
update regions set ordem = 27 where nome = '031 Belo Horizonte e região';
update regions set ordem = 28 where nome = '091 Belém e região';
update regions set ordem = 29 where nome = '083 João Pessoa e região';
update regions set ordem = 30 where nome = '081 Recife e região';
update regions set ordem = 31 where nome = '086 Teresina e região';
update regions set ordem = 32 where nome = '021 Rio de Janeiro e região';
update regions set ordem = 33 where nome = '084 Natal e região';
update regions set ordem = 34 where nome = '051 Porto Alegre e região';
update regions set ordem = 35 where nome = '069 Porto Velho e região';
update regions set ordem = 36 where nome = '095 Boa Vista e região';
update regions set ordem = 37 where nome = '079 Aracaju e região';
update regions set ordem = 38 where nome = '063 Palmas e região';
select r.nome, count(l.id) as cidades from regions r left join locations l on l.region_id = r.id
 where r.ddd in ('18') group by r.nome order by r.nome;

