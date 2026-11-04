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
