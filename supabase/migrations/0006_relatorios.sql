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
