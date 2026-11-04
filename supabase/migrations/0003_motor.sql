-- Robô de Prospecção — Fase 2 (motor de busca)
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema.

-- Rodada: guarda mensagem de erro (ex.: créditos acabaram no meio)
alter table runs add column if not exists erro text;
alter table runs add column if not exists finalizada_em timestamptz;

-- Busca: novo estado "executando" (reservada por um lote) e horário da reserva
alter table run_searches drop constraint if exists run_searches_status_check;
alter table run_searches add constraint run_searches_status_check
  check (status in ('pendente','executando','ok','erro'));
alter table run_searches add column if not exists reservada_em timestamptz;

-- Agregação: quantas buscas tiveram o mesmo domínio 2x (possíveis duas contas)
alter table run_advertisers add column if not exists duplicado_mesma_busca int not null default 0;
alter table run_advertisers add column if not exists nome text;

-- Reserva atômica de buscas para um lote. Evita que duas abas/execuções
-- façam a mesma busca (e gastem crédito duas vezes). Buscas "executando"
-- há mais de 3 minutos (lote que caiu) voltam a ser reservadas.
create or replace function reservar_buscas(p_run_id bigint, p_limite int)
returns setof run_searches
language sql
as $$
  update run_searches s
     set status = 'executando', reservada_em = now()
   where s.id in (
     select id from run_searches
      where run_id = p_run_id
        and (status = 'pendente'
             or (status = 'executando' and reservada_em < now() - interval '3 minutes'))
      order by id
      limit p_limite
      for update skip locked
   )
  returning s.*;
$$;

-- Só o servidor (chave secreta) pode chamar
revoke all on function reservar_buscas(bigint, int) from public, anon, authenticated;
grant execute on function reservar_buscas(bigint, int) to service_role;
