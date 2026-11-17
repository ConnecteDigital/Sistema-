-- Robô de Prospecção — 0014: presença por cidade.
-- Guarda, para cada anunciante × região, quantas buscas foram feitas em cada cidade e em quantas ele apareceu.
-- Assim a análise mede a força só onde ele anuncia (ex.: anuncia só em São Carlos: 35 de 40 buscas lá).
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema. Não apaga nada.

alter table run_advertisers add column if not exists por_ponto jsonb;   -- [{"p":"São Carlos","b":15,"a":4}, …]; null = rodada antiga

select 'ok' as presenca_por_cidade;
