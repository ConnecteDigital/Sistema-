-- ROBÔ DE PROSPECÇÃO — "Relógio": chama o sistema a cada 5 minutos (agendamentos, rodadas e disparos).
-- Funciona em qualquer plano da Vercel. Rode UMA vez no Supabase → SQL Editor.
--
-- ANTES DE RODAR, troque as 2 coisas marcadas:
--   1) TROQUE-PELO-CRON_SECRET   → o mesmo valor da variável CRON_SECRET na Vercel
--   2) TROQUE-PELA-CHAVE-BYPASS  → Vercel → Settings → Deployment Protection →
--                                   "Protection Bypass for Automation" → gerar/copiar a chave
--      (o projeto tem a proteção da Vercel ligada; sem essa chave o relógio é barrado)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- remove a versão anterior, se existir (pode rodar de novo)
select cron.unschedule(jobid) from cron.job where jobname = 'robo-prospeccao';

select cron.schedule(
  'robo-prospeccao',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://sistema-xi-seven.vercel.app/api/cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer TROQUE-PELO-CRON_SECRET',
      'x-vercel-protection-bypass', 'TROQUE-PELA-CHAVE-BYPASS'
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- Conferir: deve aparecer 1 linha "robo-prospeccao"
select jobid, jobname, schedule, active from cron.job where jobname = 'robo-prospeccao';

-- Depois de uns 5 minutos, para ver se as chamadas estão dando certo (status 200 = ok; 401 = chave errada):
-- select status_code, left(content::text, 200) as resposta, created from net._http_response order by created desc limit 5;
