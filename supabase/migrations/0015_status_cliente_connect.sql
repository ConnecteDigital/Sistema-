-- Robô de Prospecção — 0015: status "Cliente Connect" (cliente da agência não entra na prospecção).
-- Supabase → SQL Editor → New query → colar TUDO → Run. Pode rodar de novo sem problema. Não apaga nada.

alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check check (status in (
  'A contatar','Contatado','Respondeu','Reunião marcada','Proposta enviada','Fechado','Cliente Connect','Sem interesse','Descartado'));

select 'ok' as status_cliente_connect;
