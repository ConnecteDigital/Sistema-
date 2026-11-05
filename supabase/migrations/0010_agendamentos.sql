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
