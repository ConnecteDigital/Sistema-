-- ROBÔ DE PROSPECÇÃO — "Relógio": chama o sistema a cada 5 minutos (agendamentos, rodadas e disparos).
-- Funciona em qualquer plano da Vercel. Rode UMA vez no Supabase → SQL Editor.
--
-- ANTES DE RODAR, troque as 2 coisas marcadas:
--   1) https://SEU-ENDERECO.vercel.app  → o endereço do sistema (o mesmo que você abre no navegador)
--   2) TROQUE-PELO-CRON_SECRET          → o mesmo valor da variável CRON_SECRET na Vercel

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- remove a versão anterior, se existir (pode rodar de novo)
select cron.unschedule(jobid) from cron.job where jobname = 'robo-prospeccao';

select cron.schedule(
  'robo-prospeccao',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://SEU-ENDERECO.vercel.app/api/cron',
    headers := jsonb_build_object('Authorization', 'Bearer TROQUE-PELO-CRON_SECRET'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Conferir: deve aparecer 1 linha "robo-prospeccao"
select jobid, jobname, schedule, active from cron.job where jobname = 'robo-prospeccao';
