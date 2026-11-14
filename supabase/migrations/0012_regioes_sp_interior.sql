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
