-- 0011: Santa Catarina — Joinville, Blumenau (nova região "047 Joinville e Blumenau") e Jurerê (Florianópolis).
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
