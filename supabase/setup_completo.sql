-- ROBÔ DE PROSPECÇÃO — SCRIPT ÚNICO PARA O SUPABASE
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

insert into regions (nome, uf, ddd, descricao, ordem) values ('019 Campinas e região', 'SP', '19', 'Cidades grandes do 019', 5)
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

insert into regions (nome, uf, ddd, descricao, ordem) values ('016 Ribeirão Preto e região', 'SP', '16', 'Cidades grandes do 016', 6)
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

insert into regions (nome, uf, ddd, descricao, ordem) values ('041 Curitiba e região', 'PR', '41', 'Curitiba e região metropolitana', 7)
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

insert into regions (nome, uf, ddd, descricao, ordem) values ('048 Florianópolis e região', 'SC', '48', 'Grande Florianópolis', 8)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Florianópolis', 'Florianopolis,State of Santa Catarina,Brazil', 'City', 'minima', '48', now()),
  ('São José', 'Sao Jose,State of Santa Catarina,Brazil', 'City', 'media', '48', now()),
  ('Palhoça', 'Palhoca,State of Santa Catarina,Brazil', 'City', 'ampla', '48', now()),
  ('Biguaçu', 'Biguacu,State of Santa Catarina,Brazil', 'City', 'ampla', '48', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '048 Florianópolis e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('047 Balneário Camboriú e região', 'SC', '47', 'Litoral norte de SC', 9)
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

insert into regions (nome, uf, ddd, descricao, ordem) values ('061 Distrito Federal', 'DF', '61', 'Brasília e regiões administrativas', 10)
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

insert into regions (nome, uf, ddd, descricao, ordem) values ('062 Goiânia e região', 'GO', '62', 'Grande Goiânia', 11)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Goiânia', 'Goiania,State of Goias,Brazil', 'City', 'minima', '62', now()),
  ('Aparecida de Goiânia', 'Aparecida de Goiania,State of Goias,Brazil', 'City', 'media', '62', now()),
  ('Senador Canedo', 'Senador Canedo,State of Goias,Brazil', 'City', 'ampla', '62', now()),
  ('Trindade', 'Trindade,State of Goias,Brazil', 'City', 'ampla', '62', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '062 Goiânia e região'
on conflict (region_id, serpapi_canonical) do nothing;

insert into regions (nome, uf, ddd, descricao, ordem) values ('065 Cuiabá e região', 'MT', '65', 'Cuiabá e Várzea Grande', 12)
  on conflict (nome) do update set uf = excluded.uf, ddd = excluded.ddd, descricao = excluded.descricao, ordem = excluded.ordem;
insert into locations (region_id, nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
select r.id, v.* from regions r, (values
  ('Cuiabá', 'Cuiaba,State of Mato Grosso,Brazil', 'City', 'minima', '65', now()),
  ('Várzea Grande', 'Varzea Grande,State of Mato Grosso,Brazil', 'City', 'media', '65', now())
) as v(nome_exibicao, serpapi_canonical, tipo, camada, ddd_esperado, validado_em)
where r.nome = '065 Cuiabá e região'
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

-- Conferência: deve mostrar 13 regiões e 89 pontos
select (select count(*) from regions) as regioes, (select count(*) from locations) as pontos, (select count(*) from keyword_templates) as variacoes;
