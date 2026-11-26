-- 0016: nichos de climatização — "Ar condicionado", "Refrigeração: geladeira, freezer, câmara fria" e "PMOC e VRF".
-- Banco que já existe: Supabase → SQL Editor → New query → colar → Run. Pode rodar de novo.

insert into niches (nome, ordem) values ('Ar condicionado', 6) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('conserto de {termo}', 0),
  ('instalação de {termo}', 1),
  ('manutenção de {termo}', 2),
  ('limpeza de {termo}', 3),
  ('{termo} não gela', 4),
  ('carga de gás {termo}', 5),
  ('técnico de {termo}', 6),
  ('{termo} 24 horas', 7),
  ('{termo} perto de mim', 8)
) as v(modelo, ordem) where n.nome = 'Ar condicionado'
on conflict (niche_id, modelo) do nothing;

insert into niches (nome, ordem) values ('Refrigeração: geladeira, freezer, câmara fria', 7) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('conserto de {termo}', 0),
  ('técnico de {termo}', 1),
  ('manutenção de {termo}', 2),
  ('{termo} não gela', 3),
  ('assistência técnica {termo}', 4),
  ('{termo} 24 horas', 5),
  ('{termo} perto de mim', 6),
  ('técnico de refrigeração', 7),
  ('refrigeração comercial', 8)
) as v(modelo, ordem) where n.nome = 'Refrigeração: geladeira, freezer, câmara fria'
on conflict (niche_id, modelo) do nothing;

insert into niches (nome, ordem) values ('PMOC e VRF (climatização para empresas)', 8) on conflict (nome) do nothing;
insert into keyword_templates (niche_id, modelo, ordem)
select n.id, v.modelo, v.ordem from niches n, (values
  ('{termo}', 0),
  ('empresa de PMOC', 1),
  ('manutenção de VRF', 2),
  ('laudo PMOC', 3),
  ('instalação de VRF', 4),
  ('ar condicionado central', 5),
  ('manutenção de ar condicionado para empresas', 6)
) as v(modelo, ordem) where n.nome = 'PMOC e VRF (climatização para empresas)'
on conflict (niche_id, modelo) do nothing;

