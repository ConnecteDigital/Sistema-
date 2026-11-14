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
