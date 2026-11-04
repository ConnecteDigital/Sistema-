-- ROBÔ DE PROSPECÇÃO — remove as 20 cidades pequenas que não existem na SerpApi.
-- Supabase → SQL Editor → New query → colar TUDO → Run.
-- Só apaga pontos AINDA NÃO VALIDADOS com esses nomes. Não mexe em mais nada.

delete from locations
where validado_em is null
  and nome_exibicao in (
    'Sena Madureira','Tarauacá','Feijó','Senador Guiomard','Laranjal do Jari','Oiapoque','Mazagão',
    'Iranduba','Raposa','Benevides','Conde','Altos','José de Freitas','Campo Maior','Rorainópolis',
    'Caracaraí','Mucajaí','Alto Alegre','Barra dos Coqueiros','Miracema do Tocantins'
  );

-- Conferência: "pendentes" deve dar 0
select
  (select count(*) from locations) as pontos,
  (select count(*) from locations where validado_em is null) as pendentes;
