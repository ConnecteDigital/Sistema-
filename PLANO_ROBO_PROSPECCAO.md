# Robô de Prospecção — Connect Digital

Documento de especificação para construir o sistema no Claude Code. Escrito em 04/11/2026 a partir de dois dias de testes reais com SerpApi, DataForSEO, Serper.dev e Apify. Tudo aqui foi testado na prática, salvo onde está escrito "a validar".

> **Para o Claude Code:** leia este documento inteiro antes de começar. Ele é a fonte da verdade do projeto. Trabalhe em fases (seção 15), confirme comigo ao final de cada fase e não pule decisões já tomadas (seção 3). Nenhuma chave de API está neste documento; todas entram como variáveis de ambiente.

> **Revisão 1 (04/11/2026) — SEM LOGIN.** O sistema é privado, usado só pela equipe da Connect Digital. **Não há tela de login nem cadastro de usuários**: ao abrir o endereço, entra direto. Isso muda as seções 1, 2, 4, 12, 15 e 16 (marcadas com *[rev. 1]*). Ver também a seção 18 (decisões em aberto).

---

## 1. Objetivo

A Connect Digital é uma agência que só trabalha com Google (Google Ads, criação de site, SEO e gestão de campanhas), focada em prestadores de serviço, principalmente **desentupidoras** (também encanador, eletricista, serralheiro, caça vazamento, limpa fossa).

**Cliente ideal:** quem **já anuncia no Google Ads hoje** e está com **resultado fraco**.

O robô precisa:
1. Descobrir **quem está anunciando agora** (patrocinados ao vivo) para uma palavra-chave, em um conjunto de cidades e bairros, simulando **celular**.
2. Medir a **força da presença** de cada anunciante (em quantas buscas aparece, posição, topo/rodapé, sitelinks).
3. **Abrir o site** de cada anunciante e encontrar telefone/WhatsApp, tag do Google Ads e problemas (site fora do ar, hospedagem suspensa, domínio vencido).
4. Aplicar regras e entregar uma **lista priorizada** para o prospectador ligar, com o argumento de abordagem pronto.
5. Guardar histórico (rodadas em horários diferentes) e o status de cada lead (mini CRM).

Quem usa: Gabriel (dono) e o prospectador. Acesso pelo navegador, **sem login** *[rev. 1]* — abriu o endereço, entrou direto.

---

## 2. Stack

| Camada | Escolha |
|---|---|
| App | **Next.js (App Router) + TypeScript**, Node.js |
| UI | Tailwind + shadcn/ui. Tela inicial estilo Google: limpa, um campo central |
| Hospedagem | **Vercel** — time `connect-digitals-projects` (uso comercial exige plano Pro) |
| Código | **GitHub**, organização `ConnecteDigital`, repositório `Sistema-` |
| Banco | **Supabase** (Postgres). **Sem Supabase Auth** *[rev. 1]*. RLS ligado e sem políticas para `anon` (o navegador não acessa o banco direto); todo acesso passa pelo servidor do Next.js com a `service_role` |
| Motor de busca | **SerpApi**, engine `google_ads` |
| Apoio (opcional) | **DataForSEO** (ler sites que bloqueiam robôs; investigação de conta de anunciante) |
| IA (opcional) | **API do Claude** (modelo leve) só para interpretar comando em texto livre e sugerir variações. O sistema tem que funcionar 100% sem ela |
| Planilha | `exceljs` para exportar `.xlsx` |
| Agendamento | **Vercel Cron** |

---

## 3. Decisões já tomadas (não reabrir)

1. **SerpApi é o motor principal e único para achar anúncios.** Testamos as alternativas lado a lado, na mesma hora, mesma busca ("encanador", São Paulo, celular):
   - SerpApi `google_ads`: **5–6 anúncios** por busca, com cidade e celular funcionando.
   - **Serper.dev: 0 anúncios em 6 buscas** (só traz orgânico). Descartado.
   - **Apify (`litescrape/google-ads`): 0 anúncios** e a localização não foi aplicada de verdade (orgânicos de Cuiabá, Canoas e Londrina para busca em SP). Descartado.
   - **DataForSEO SERP orgânica/ao vivo:** quase nunca traz o bloco pago (1 em 4 testes, com 2 anúncios). Não serve como motor.
2. **DataForSEO Central de Transparência NÃO substitui a busca ao vivo.** A palavra é buscada no **nome do anunciante**, não na palavra-chave do anúncio; não tem filtro por cidade (só "Brazil"). No teste, os 4 anunciantes ao vivo em SP não tinham "encanador" no nome e não apareceram. A lista de 114 "anunciantes" feita só pela Transparência inclui contas paradas há meses — **não usar para ligar** sem filtro de data. A Transparência só entra como ferramenta de investigação (seção 11).
3. **Google Maps está fora.** O foco é quem aparece no patrocinado. Não gastar crédito com Maps.
4. **Leitura de site é feita pelo nosso próprio servidor** (fetch direto, grátis). DataForSEO OnPage só como plano B para sites que bloqueiam robô (HTTP 403) ou que só renderizam com JavaScript.
5. **Não fazer scraping direto do Google.** O Google bloqueia com CAPTCHA e contornar isso vai contra as regras dele. Isso é o que a SerpApi resolve.
6. **Celular sempre** (`device=mobile`). Quem busca serviço de emergência está no celular, e o resultado muda bastante em relação ao computador.
7. Gabriel prefere **mais variações de palavra-chave do que lugares**, focando em **cidades grandes**, não nas pequenas.
8. **Sem login** *[rev. 1]*. Sistema privado, sem tela de login, sem cadastro de usuários, sem papéis (admin/prospector). Todo mundo que abre o sistema pode tudo.

---

## 4. Como o sistema é usado (fluxo de telas)

### 4.1 Tela "Nova pesquisa" (tela inicial, estilo Google)

**Modo formulário (padrão, grátis):**
1. Campo **palavra-chave** (ex.: `encanador`).
2. O sistema mostra **sugestões de variações** em chips selecionáveis, a partir de modelos por nicho (seção 6). Ex.: `encanador 24 horas`, `encanador perto de mim`, `encanador mais próximo`, `encanador emergência`. O usuário marca as que quer e pode digitar outras.
3. **Área:** estado → região/DDD (ex.: `011 Capital`, `011 ABC`, `013 Baixada Santista`, `019 Campinas e região`, `016 Ribeirão Preto e região`, DF, capitais) → **tamanho** da pesquisa:
   - *Mínima* (cidade-polo / 4 zonas),
   - *Média* (principais bairros/cidades),
   - *Ampla* (tudo que está cadastrado na região).
   O usuário pode desmarcar e marcar pontos individualmente.
4. **Prévia do plano e do custo** antes de rodar: `6 variações × 8 pontos = 48 buscas · créditos disponíveis: 212`. Botão **Pesquisar**.

**Modo comando (opcional, usa a API do Claude):**
- Uma caixa de texto livre: *"encanador em toda a 013, cidades grandes, umas 5 variações"*. O Claude devolve um JSON com `termos[]` e `pontos[]` (usando só pontos que existem no catálogo, seção 7). O sistema mostra o mesmo resumo de plano + custo para confirmar. Nunca roda sem confirmação.
- Ditado por voz não precisa de nada no sistema: o Windows já transcreve (Win + H).

### 4.2 Tela "Rodada" (progresso e resultado)
- Barra de progresso: buscas feitas / total, anunciantes encontrados, sites verificados.
- Ao terminar: tabela de **leads** com filtros (região, força, prioridade, status), ordenada por prioridade e depois por presença crescente.
- Botão **Baixar Excel**.

### 4.3 Tela "Leads" (CRM simples)
- Todos os anunciantes já encontrados, de todas as rodadas, deduplicados por domínio.
- Colunas editáveis: **Status**, **Responsável**, **Data do contato**, **Notas**.
- **Responsável** *[rev. 1]*: escolhido de uma lista simples de nomes da equipe (tabela `equipe`, editável em Configurações), já que não há usuários logados.
- Detalhe do lead: histórico de aparições por rodada/horário, títulos dos anúncios, pontos onde apareceu, dados do site, observações, link do anúncio.

### 4.4 Tela "Configurações"
- **Chaves da SerpApi** (várias) com créditos restantes de cada uma.
- Chave DataForSEO (opcional), chave Claude (opcional).
- Catálogo de regiões e pontos; modelos de variações por nicho; lista de exclusão (marketplaces, seguradoras); limites de força.
- **Equipe** *[rev. 1]*: nomes que aparecem em "Responsável".
- Agendamentos (rodadas automáticas).

---

## 5. Motor de busca — SerpApi (detalhes testados)

### 5.1 Chamada
```
GET https://serpapi.com/search.json
  engine=google_ads
  q=<termo>
  location=<nome canônico da SerpApi, ex.: "Itaquera,State of Sao Paulo,Brazil">
  google_domain=google.com.br
  gl=br
  hl=pt-br
  device=mobile
  api_key=<chave>
```
- O engine `google_ads` **exige `location`** (não aceita `uule`/GPS — testado, retorna erro "Missing `location` parameter").
- A SerpApi tem **cache de 1 hora**: repetir exatamente a mesma busca dentro de 1h não gasta crédito. Para comparar horários, as rodadas precisam estar a mais de 1h de distância (ou usar `no_cache=true`, que gasta crédito).
- Retorno útil: `ads[]` com `position`, `block_position` (`top`/`bottom`), `title`, `link`, `displayed_link`, `source`, `sitelinks[]`, `extensions[]`, `rating`, `reviews`, `tracking_link`. Também `search_metadata.status`, `search_parameters.location_used`.
- Normalmente vêm **até 6 anúncios** por busca (topo + rodapé). Não há páginas 2/3 úteis para anúncios.

### 5.2 Casos especiais encontrados nos dados
- **Anúncio sem `link`:** usar `displayed_link` e `source` para identificar o anunciante (ex.: `mouradesentupidora.bsb.br`, `desentupidorasos.com`).
- **Anúncio que leva para `business.google.com`:** é o perfil do Google, não o site. Identificar pelo `source` (ex.: "Desentupidor Profissional") e marcar a observação "O anúncio leva direto para o perfil do Google".
- **Mesmo domínio duas vezes na mesma busca** (topo e rodapé): o Google normalmente não mostra dois anúncios do mesmo anunciante, então isso costuma indicar **duas contas de Google Ads no mesmo site**. Registrar como observação.
- **Subdomínios:** agrupar pelo domínio raiz (`sc.ozielhidro.com.br` → `ozielhidro.com.br`), respeitando sufixos brasileiros (`com.br`, `net.br`, `org.br`, `tec.br`, `srv.br`, `eco.br`, `app.br`, `ind.br`, `eng.br`, `adv.br`, `blog.br`, `emp.br`, `art.br`, `bsb.br`).

### 5.3 Catálogo de locais
- Endpoint **grátis** (não gasta crédito): `GET https://serpapi.com/locations.json?q=<texto>&limit=10` → `canonical_name`, `target_type` (City, District, State, Airport), `country_code`.
- Só usar locais com `country_code = BR`. Guardar o `canonical_name` exato.
- Ver o apêndice A com os locais já validados e os que **não existem** no catálogo.

### 5.4 Créditos e várias chaves
- Endpoint **grátis**: `GET https://serpapi.com/account.json?api_key=<chave>` → `plan_name`, `searches_per_month`, `this_month_usage`, `plan_searches_left`, `this_hour_searches`, `account_rate_limit_per_hour`.
- O plano grátis tem **250 buscas/mês por conta**.
- Gabriel quer cadastrar **várias chaves (ex.: 10 contas)** e que o sistema **troque automaticamente** para a próxima quando a atual estiver acabando:
  - Antes de cada rodada: consultar `account.json` de todas as chaves ativas e somar os créditos.
  - Se o total for menor que o necessário, **avisar antes de rodar** ("Plano precisa de 48 buscas, você tem 30. Adicione uma chave ou reduza o plano").
  - Durante a rodada: usar a chave com mais créditos; ao chegar no limite configurável (padrão: **2 créditos restantes**), passar para a próxima. Se uma busca falhar por cota, trocar de chave e repetir aquela busca.
  - Mostrar na tela os créditos de cada chave e o total.
  - **Aviso registrado:** os termos da SerpApi não proíbem várias contas com todas as letras, mas dizem que ela pode encerrar contas a qualquer momento. Várias contas grátis da mesma pessoa podem ser bloqueadas. Quando virar rotina, o plano Starter (US$25/1.000 buscas) remove esse risco. O sistema deve funcionar igual com uma chave paga.
- Limite por hora: a conta grátis reportou `account_rate_limit_per_hour = 250`. Rodar com **4 a 6 buscas em paralelo** funcionou bem.

### 5.5 Custo de referência
- 1 busca = 1 crédito. No plano Starter, ~US$0,025 por busca.
- Exemplos reais: 6 regiões (25 pontos × 2 termos) = **50 buscas**; SP capital + ABC (23 pontos × 2 termos) = **46 buscas**.
- 019 completo tem 73 municípios: 3 variações × 73 = 219 buscas. Por isso, presets por "cidades grandes".

---

## 6. Variações de palavra-chave

Modelos por nicho (editáveis em Configurações). `{termo}` é o que o usuário digitou.

| Nicho | Sugestões |
|---|---|
| Desentupidora | `{termo}`, `{termo} 24 horas`, `{termo} perto de mim`, `{termo} mais próxima`, `desentupimento`, `desentupir esgoto`, `desentupidora de vaso` |
| Encanador | `{termo}`, `{termo} 24 horas`, `{termo} perto de mim`, `{termo} mais próximo`, `{termo} emergência`, `serviços hidráulicos`, `caça vazamento` |
| Eletricista | `{termo}`, `{termo} 24 horas`, `{termo} perto de mim`, `{termo} residencial`, `{termo} emergência` |
| Serralheiro | `{termo}`, `serralheria`, `serralheria perto de mim`, `{termo} 24 horas` |
| Caça vazamento | `{termo}`, `caça vazamento 24 horas`, `detecção de vazamento`, `vazamento de água` |
| Limpa fossa | `{termo}`, `limpa fossa 24 horas`, `limpeza de fossa`, `caminhão limpa fossa` |

Observação dos testes: variações muito parecidas ("desentupidora" e "desentupidora 24 horas") trouxeram quase os mesmos anunciantes, e pontos geográficos diferentes trouxeram anunciantes novos. Mesmo assim, a escolha de quantas variações usar é do usuário. O sistema mostra o custo e deixa decidir.

Opcional: o usuário pode incluir a cidade no termo ("encanador em Campinas") além do `location`.

---

## 7. Catálogo de regiões e pontos

Tabela `regions` (ex.: "011 Capital", "011 ABC", "013 Baixada Santista", "019 Campinas e região", "Distrito Federal", "Curitiba e região") e `locations` (ponto = nome de exibição + `canonical_name` SerpApi + região + camada `minima|media|ampla` + DDD esperado).

- Na hora de cadastrar, validar cada ponto no `locations.json` (grátis).
- O DDD esperado é usado na regra "telefone com DDD fora da região".
- O apêndice A traz o seed inicial já validado.
- **Revisão 2 (04/11/2026) — Brasil inteiro:** os 27 estados estão no catálogo. Cada estado tem uma região "capital e região" com a capital (camada mínima) e as 5–7 cidades grandes mais próximas (média/ampla), cada uma com seu DDD. SP mantém as regiões detalhadas (011 Capital por distritos, ABC, Grande SP, 012, 013, 016, 019). Os pontos novos entram como "não validados" e são conferidos pelo botão "Validar locais" (grátis), que corrige o nome sozinho quando há um equivalente no mesmo estado e desativa o que não existe na SerpApi. A tela de pesquisa agrupa por **estado → região → tamanho**.

---

## 8. Processamento de uma rodada

### 8.1 Plano
`runs` (uma rodada) → `run_searches` (cada combinação termo × ponto, status `pendente|ok|erro`, chave usada, horário).

### 8.2 Execução na Vercel (importante)
Uma rodada leva minutos (50 buscas + 30–60 sites). Função serverless tem limite de duração, então:
- `POST /api/runs` cria a rodada e todas as `run_searches` como `pendente`.
- `POST /api/runs/:id/work` processa um **lote** (ex.: 8 buscas em paralelo, depois os sites pendentes), salva tudo e retorna o progresso. Configurar `maxDuration` adequado.
- A tela da rodada chama `/work` repetidamente até terminar (e mostra o progresso). O Cron também chama `/work` para rodadas agendadas.
- Tudo idempotente: se cair no meio, continua de onde parou.

### 8.3 Agregação (por região da rodada)
Para cada anunciante (domínio raiz) na região:
- `aparicoes` = número de combinações distintas (ponto, termo) em que apareceu.
- `buscas` = total de buscas da região na rodada.
- `presenca` = aparicoes / buscas.
- `pontos[]`, `termos[]`, `pos_media`, `pct_topo` (`block_position = top`), `pct_sitelinks`, título mais frequente, link mais frequente, `source` (nome) quando não for domínio.
- Guardar também o bruto (`ads_raw`) para auditoria e para a aba "Buscas (bruto)" do Excel.

### 8.4 Força da presença (limites configuráveis)
- **Fraca:** presença < 40%
- **Média:** 40% a 75%
- **Forte:** > 75%

Leitura: quem aparece pouco provavelmente tem orçamento curto ou campanha mal configurada → lead mais quente. **É uma foto de um horário**: só afirmar "você quase não aparece" depois de rodadas em horários diferentes (seção 10).

---

## 9. Verificação do site (nosso servidor, grátis)

Para cada domínio novo (ou verificado há mais de X dias), abrir o **link do anúncio** (não só a home):

| O que checar | Como |
|---|---|
| Status | Código HTTP, URL final após redirecionamentos, tempo de resposta |
| **Site fora do ar** | Falha de DNS; erro 5xx; timeout; páginas de hospedagem suspensa (`Account Suspended`, `This Account has been suspended`, `Conta suspensa`); páginas de domínio estacionado/à venda |
| Bloqueio de robô | HTTP 403 → marcar "Site bloqueia robôs" e, se a chave DataForSEO estiver configurada, tentar pelo plano B |
| Telefones | Links `tel:`; WhatsApp em `wa.me/`, `api.whatsapp.com/send?phone=`, `whatsapp://send?phone=`; texto com padrão de telefone BR como último recurso |
| Normalização | Tirar `+55`/`55`, aceitar 10–11 dígitos, formatar `(DD) NNNNN-NNNN`. Tratar 0800 (vem como `(80) 0xxx-xxxx` se não tratar) e 4003 como números nacionais. Descartar lixo (número local começando com 0, `0000-0000`) |
| Tag do Google Ads | `AW-\d{8,}` → "Sim". Só `GTM-XXXX` → "Só Tag Manager (não dá pra confirmar)". Nenhum dos dois em página completa → "Não encontrada" |
| Cuidado | HTML muito pequeno (< ~15 KB) sem scripts pode ser página carregada por JavaScript → marcar "Não verificado" em vez de "Não encontrada", a menos que seja uma página estática simples. Foi o caso da LMC: 7 KB porque a página era "Account Suspended" |
| Outros sinais (bônus) | GA4 `G-XXXX`, WordPress (`wp-content`), botão de WhatsApp visível |

**Plano B (DataForSEO OnPage), só se configurado:**
- `POST /v3/on_page/instant_pages` com `{"url":..., "store_raw_html": true}` (≈ US$0,00015) ou com `enable_javascript: true` (≈ US$0,0015) / `enable_browser_rendering: true` (≈ US$0,005).
- Depois `POST /v3/on_page/raw_html` com `{"id": <task id>}` para pegar o HTML.

---

## 10. Regras, observações e prioridade

Observações geradas automaticamente (texto pronto para o prospectador):

| Regra | Observação | Efeito na prioridade |
|---|---|---|
| Site fora do ar / hospedagem suspensa / domínio vencido **e** anúncio rodando | "SITE FORA DO AR e o anúncio continua rodando: está pagando clique para uma página de erro" | **Máxima** |
| Mesmo WhatsApp/telefone em **3 ou mais domínios diferentes** | "Mesmo WhatsApp em N sites: parece rede/agência que gera leads, não o dono direto" | Baixa |
| Só divulga 0800/4003 | "Só divulga 0800: empresa grande ou central" | Baixa |
| Domínio na lista de exclusão (GetNinjas, Porto Seguro, marketplaces, guias) | Excluir da lista de leads (manter no bruto) | — |
| Página de guia/agência anunciando para terceiro | "Página de agência/guia — concorrente, não lead" | Baixa |
| Telefone principal com DDD fora da região | "Telefone com DDD X (região é Y): pode ser central ou empresa de fora" | — |
| Mesmo telefone ou mesma tag `AW-`/`GTM-` em dois domínios | "Mesmo dono que <domínio>: ligar uma vez só" | — |
| Aparece em mais de uma região | "Também aparece em <região>: ligar uma vez só" | — |
| Sem tag do Google (página completa) | "Nenhuma tag do Google no site: provavelmente não mede conversões. Argumento forte" | — |
| Anúncio sem sitelinks em todas as aparições | "Anúncio sem sitelinks" | — |
| Anúncio leva ao perfil do Google | "O anúncio leva para o perfil do Google, não para o site" | — |
| Duas posições na mesma busca | "Aparece duas vezes: possivelmente duas contas de Google Ads" | — |
| Telefone não encontrado | "Pegar o telefone abrindo o anúncio no celular" | — |

**Prioridade final:** `Máxima` (site fora do ar) › `Alta` (força Fraca ou Média, sem regra de baixa) › `Normal` (força Forte) › `Baixa` (rede, 0800, agência).

**Telefone principal:** preferir WhatsApp com DDD da região e 11 dígitos; depois fixo da região; depois outros. Nunca escolher o número da "rede" nem número nacional se houver um local.

---

## 10.1 Consultar CNPJ (botão, sob demanda) *[rev. 3]*

Ao lado de cada anunciante, botão **"Consultar CNPJ"**. Só roda quando clicado (grátis) e guarda o resultado (`consultas_cnpj`):
1. **Registro.br (RDAP)** — `https://rdap.registro.br/domain/<dominio>`: titular do domínio `.br`. Traz o CNPJ quando o dono é empresa; quando é pessoa física, mostra só o nome (CPF fica oculto).
2. **O próprio site** — página do anúncio, home e `/contato`, `/politica-de-privacidade`, `/sobre`, `/quem-somos`: procura CNPJ escrito (com validação dos dígitos).
3. **Dados da Receita** — BrasilAPI (`/api/cnpj/v1/<cnpj>`), com `publica.cnpj.ws` como reserva: razão social, nome fantasia, situação, abertura, atividade, endereço, telefones, e-mail e **sócios**.

A verificação automática de site (seção 9) também guarda os CNPJs achados no HTML (`site_checks.cnpjs`).

**Revisão 4 — CNPJ automático:** a consulta roda sozinha como etapa 3 da rodada (buscas → sites → CNPJs → leads), reaproveitando os CNPJs achados na verificação do site. Os dados da Receita ficam em cache por CNPJ (`empresas_cnpj`, 90 dias): o mesmo CNPJ nunca é consultado duas vezes. Mesmo CNPJ em sites diferentes = mesmo dono (observação + agrupamento). A tela da rodada abre com o **Relatório — quem ligar**: um dono por linha (agrupado por CNPJ, telefone ou tag AW-), em ordem de prioridade, com telefone, argumento e botão para copiar a lista.

## 11. DataForSEO — usos de apoio (opcionais)

Autenticação Basic (login:senha da API). Endpoints testados:

| Uso | Endpoint | Observação |
|---|---|---|
| Ler site bloqueado | `on_page/instant_pages` + `on_page/raw_html` | Seção 9 |
| Conta de anunciante de um domínio | `serp/google/ads_search/task_post` com `{"target":"dominio","location_name":"Brazil","platform":"all"}` → `task_get/advanced/<id>` | Retorna `advertiser_id`, nome verificado, `first_shown`, `last_shown` de cada anúncio |
| Tudo que uma conta anuncia | `ads_search` com `{"advertiser_ids":[...até 25]}` | Revela outros sites do mesmo anunciante |
| Confirmar se está ativo | `ads_search` com `date_from`/`date_to` (ex.: últimas 48h) | Funciona, mas **não cobre todos**: a Hydraviliki estava ao vivo e não apareceu |
| WHOIS | `domain_analytics/whois/overview/live` com filtro de domínio | Caro (≈ US$0,12/consulta). Mostra criação/expiração do domínio; não mostra suspensão de hospedagem |

**Não usar DataForSEO** para descobrir anunciantes ao vivo, nem Maps.

**Revisão 5 — Conta do Google Ads no lead:** o registrante do domínio muitas vezes não é o dono (gestor, parente, agência). No detalhe do lead, o botão "Ver conta do Google Ads (Transparência)" roda `ads_search` pelo domínio (etapa 1: descobre `advertiser_id` e nome verificado) e depois pelos `advertiser_ids` (etapa 2: outros sites da mesma conta). Resultado em `contas_google_ads` (resumo + resposta bruta). Nome com LTDA/ME/EIRELI… = conta em CNPJ; senão provável pessoa física.

---

## 12. Banco de dados (Supabase) — esquema *[rev. 1]*

Sem Supabase Auth: a tabela `profiles` foi substituída por `equipe` (só nomes), e os campos que apontavam para usuário viram referência à equipe ou texto livre.

```
equipe(id, nome, ativo bool, criado_em)          -- [rev. 1] substitui profiles

serp_keys(id, apelido, chave_criptografada, ativa bool, limite_troca int default 2,
          creditos_restantes int, plano text, verificada_em timestamptz)

regions(id, nome, uf, ddd text, descricao)
locations(id, region_id fk, nome_exibicao, serpapi_canonical, tipo 'City'|'District',
          camada 'minima'|'media'|'ampla', ddd_esperado, ativo bool)

niches(id, nome)
keyword_templates(id, niche_id fk, modelo text, ordem int)

runs(id, criado_em, origem 'manual'|'agendada',                -- [rev. 1] sem criado_por
     termos text[], status 'pendente'|'buscando'|'verificando'|'pronta'|'erro',
     total_buscas int, buscas_ok int, creditos_usados int, comando_original text null)
run_searches(id, run_id fk, location_id fk, termo, status, serp_key_id fk,
             executada_em, location_usada, qtd_anuncios int, erro text)
ads_raw(id, run_search_id fk, position int, block_position, title, link, displayed_link,
        source, dominio, sitelinks jsonb, extensions jsonb, rating, reviews)

advertisers(id, dominio unique, nome, primeiro_visto, ultimo_visto)
run_advertisers(id, run_id fk, region_id fk, advertiser_id fk, aparicoes, buscas,
                presenca numeric, pontos text[], termos text[], pos_media, pct_topo,
                pct_sitelinks, titulo, link, forca 'Fraca'|'Média'|'Forte')

site_checks(id, advertiser_id fk, url, verificado_em, http_status, url_final,
            situacao 'ok'|'fora_do_ar'|'suspenso'|'dns'|'bloqueado'|'nao_verificado',
            telefones text[], whatsapps text[], tags_aw text[], tags_gtm text[],
            ga4 text[], tamanho_html int, via 'proprio'|'dataforseo')

leads(id, advertiser_id fk unique, prioridade, telefone_principal, outros_telefones text[],
      observacoes text[], status 'A contatar'|'Contatado'|'Respondeu'|'Reunião marcada'|
      'Proposta enviada'|'Fechado'|'Sem interesse'|'Descartado',
      responsavel_id fk equipe null, data_contato date, notas text, atualizado_em)   -- [rev. 1]
lead_events(id, lead_id fk, autor text null, tipo, texto, criado_em)               -- [rev. 1]

blocklist(id, dominio, motivo)   -- getninjas.com.br, portoseguro.com.br, etc.
schedules(id, nome, cron, termos text[], location_ids int[], ativo bool)
settings(chave, valor jsonb)      -- limites de força (0.40 / 0.75), limite de troca de chave, etc.
```

- **RLS ligado em todas as tabelas, sem nenhuma política para `anon`/`authenticated`** *[rev. 1]*. Resultado: a chave pública do Supabase não lê nada; só o servidor (com `service_role`) acessa o banco. O navegador fala apenas com as rotas `/api` do Next.js.
- Chaves de API **nunca** vão para o navegador. Guardar criptografadas (`KEYS_ENCRYPTION_SECRET`) e usar só no servidor. Na tela, mostrar só o apelido e o final da chave (`••••a1b2`).

---

## 13. Rodadas agendadas e comparação de horários

- **Vercel Cron** dispara as rodadas cadastradas em `schedules` (sugestão inicial: 7h30, 12h30 e 20h, horário de Brasília; Cuiabá é 1h a menos).
- Na tela do lead: presença por horário (manhã/tarde/noite). Ex.: "apareceu em 80% de manhã e 10% à noite" → orçamento acabando cedo → argumento de venda.
- Antes de agendar, calcular o custo mensal estimado (buscas × execuções) e comparar com os créditos.

---

## 14. Exportação Excel

Mesmo formato das planilhas que já usamos:
- **Aba "Como usar":** de onde vêm os dados, data/hora da rodada, onde foi buscado, legenda das colunas, limites de força (células editáveis), resumo por região (fórmulas `COUNTIF`/`COUNTIFS`).
- **Aba "Leads":** Região · Anunciante · Site · Aparições · Buscas na região · Força (fórmula) · Prioridade · % presença · Pontos onde apareceu · Termos · Posição média · % no topo · % com sitelinks · Título do anúncio · Telefone principal · Outros telefones · Tag Google Ads no site · Observações · Abrir anúncio (link) · Status (lista suspensa) · Responsável · Data do contato · Notas. Colunas do prospectador em amarelo; congelar cabeçalho; filtro automático.
- **Aba "Buscas (bruto)":** Região · Ponto · Termo · Posição · Bloco · Anunciante (site) · Título · Sitelinks.

---

## 15. Fases de entrega

**Fase 1 — Base** *[rev. 1]*
- Projeto Next.js no repositório `ConnecteDigital/Sistema-`, Supabase (tabelas da seção 12), deploy na Vercel. **Sem login.**
- Configurações: cadastro de chaves SerpApi com consulta de créditos (`account.json`); cadastro da equipe.
- Seed do catálogo de locais (apêndice A) e dos modelos de variações (seção 6).
- *Pronto quando:* abro o endereço, entro direto, cadastro chaves e vejo os créditos de cada uma.

**Fase 2 — Motor**
- Tela de nova pesquisa (formulário), prévia do plano e custo, execução em lotes, troca automática de chave, agregação, força.
- *Pronto quando:* rodar "desentupidora" + "desentupidora 24 horas" nos 16 pontos de SP capital e ver a lista de anunciantes com presença, igual à planilha que já temos.

**Fase 3 — Sites e regras**
- Verificação de site (seção 9), regras e prioridade (seção 10), tela de leads com detalhe.
- *Pronto quando:* a LMC Desentupidora aparece como prioridade **Máxima** ("site fora do ar") e as redes/0800 como Baixa.

**Fase 4 — Excel e CRM**
- Exportação `.xlsx` (seção 14), status/responsável/notas editáveis, histórico de contatos.

**Fase 5 — Agendamento e horários**
- Vercel Cron, comparação manhã/tarde/noite.

**Fase 6 — Opcionais**
- Modo comando com a API do Claude (texto livre → plano JSON validado contra o catálogo).
- Plano B DataForSEO para sites bloqueados.
- Ferramenta de investigação de anunciante (Transparência: conta, outros sites, último anúncio).
- **Módulo "campanha ativa + site fora do ar"**: rodada focada em encontrar só anunciantes ativos com site quebrado, para abordagem imediata (oferecer site + gestão). Ideia validada no caso LMC, que virou um projeto novo.

---

## 16. Variáveis de ambiente *[rev. 1]*

```
SUPABASE_URL=                    # https://<projeto>.supabase.co
SUPABASE_SECRET_KEY=             # sb_secret_... — só no servidor
KEYS_ENCRYPTION_SECRET=          # para criptografar as chaves SerpApi no banco
ACESSO_CODIGO=                   # opcional: vazio = abre direto; preenchido = pede o código 1x por navegador
DATAFORSEO_LOGIN=                # opcional
DATAFORSEO_PASSWORD=             # opcional
ANTHROPIC_API_KEY=               # opcional (modo comando)
CRON_SECRET=                     # proteger as rotas chamadas pelo Cron
```

A chave pública (`sb_publishable_...`) e a URL de JWKS do Supabase **não são usadas**: o navegador não acessa o Supabase direto e não há login.

**Segurança:** as chaves da SerpApi, DataForSEO, Serper e Apify usadas nos testes apareceram numa conversa. **Gerar chaves novas** em todos os serviços antes de cadastrar no sistema.

---

## 17. Dados reais de referência (para validar o sistema)

- **6 regiões (04/11, manhã):** 50 buscas, 56 anunciantes, 39 com prioridade alta. Achados: 6 sites com o mesmo WhatsApp `(11) 91415-2178` (rede: chicodesentupidora.com, desentupidorahidromaster.com, joaodesentupidor.com, primedesentupidora.com, nexusambientaldesentope.com.br, desentupidoradesentoperapido.com); `brasiliadesentupidoradf.com.br` e `desentupidorareidoesgotodf.com.br` com o mesmo telefone; `rapidaservicosctba.com.br`, `desentupidorazeroentupdf.com.br` e `desentupidorasanitch.com.br` sem nenhuma tag do Google.
- **SP capital + ABC (04/11, ~11h40):** 46 buscas, 19 empresas únicas. Mercado concentrado: `desentoprapido.com.br` em 29/32 buscas; `hidropro.com.br`, `desentupidorasuporte.com.br`, `lmcdesentupidora.com.br` quase sempre. `socorrodesentupidora.com.br` e `desentupidorprofissional.com.br` têm o mesmo WhatsApp e a mesma tag `AW-970787061` (mesmo dono).
- **Caso LMC:** `lmcdesentupidora.com.br` com hospedagem suspensa ("Account Suspended") e anúncio rodando em 20/32 buscas em SP e 8/14 no ABC. Domínio válido até 18/02/2027 (o problema era a hospedagem). Contato feito pelo Gabriel → fechou projeto de site novo. É o exemplo-modelo do módulo "site fora do ar".

---

## 18. Decisões em aberto (responder antes/durante a Fase 1)

1. **Endereço público sem senha.** Sem login, qualquer pessoa que descobrir o endereço `*.vercel.app` consegue gastar os créditos da SerpApi, ver e editar os leads e baixar o Excel. Opções, da mais leve à mais forte:
   - (a) Sem proteção nenhuma (como pedido) + endereço difícil de adivinhar + `noindex` para o Google não indexar.
   - (b) **Proteção da própria Vercel** (Vercel Authentication / senha do deployment): não muda nada no sistema, mas pede login da Vercel ou senha no navegador.
   - (c) Um **código de acesso único** digitado uma vez por navegador (fica lembrado por 1 ano). Não é tela de login de usuário, é só um cadeado na porta.
2. **Repositório:** o plano original sugeria `robo-prospeccao`; o trabalho está no `ConnecteDigital/Sistema-`. Manter este?
3. **Créditos dos testes:** confirmar que as chaves antigas foram trocadas (seção 16).

---

## Apêndice A — Locais já validados na SerpApi (`canonical_name`)

**São Paulo capital (District):** `Consolacao,State of Sao Paulo,Brazil` · `Bom Retiro,…` · `Mooca,…` · `Tatuape,…` · `Penha,…` · `Itaquera,…` · `Sao Miguel Paulista,…` · `Guaianases,…` · `Santana,…` · `Tucuruvi,…` · `Vila Maria,…` · `Freguesia do O,…` · `Pinheiros,State of Sao Paulo,Brazil` · `Lapa,…` · `Butanta,…` · `Vila Mariana,…` · `Ipiranga,…` · `Santo Amaro,…` · `Jabaquara,…` · `Capao Redondo,…` · `Campo Limpo,…` (o `…` é `,State of Sao Paulo,Brazil`)
- Cidade: `Sao Paulo,State of Sao Paulo,Brazil` (posiciona no centro — não serve sozinho para achar anunciantes pequenos).
- **Não existem no catálogo:** Moema, Zona Leste (como local), Sé, Brasilândia, Interlagos, República, Bela Vista, Liberdade, Santa Cecília. Colocar o bairro só no texto da busca **não** muda o local.
- Pinheiros veio com poucos anúncios (2–3).

**ABC (City):** `Santo Andre,State of Sao Paulo,Brazil` · `Sao Bernardo do Campo,…` · `Sao Caetano do Sul,…` · `Diadema,…` · `Maua,…` · `Ribeirao Pires,…` · `Rio Grande da Serra,…`
**Grande SP (City):** `Guarulhos,…` · `Osasco,Osasco,State of Sao Paulo,Brazil` · `Campinas,…` · `Sao Jose dos Campos,…` (validar os demais do 019/013 no seed)

**Curitiba e região:** `Curitiba,State of Parana,Brazil` · `Sao Jose dos Pinhais,State of Parana,Brazil` · `Colombo,State of Parana,Brazil` · `Araucaria,State of Parana,Brazil` · `Pinhais,State of Parana,Brazil` · `Almirante Tamandare,State of Parana,Brazil`
**Florianópolis e região:** `Florianopolis,State of Santa Catarina,Brazil` · `Sao Jose,State of Santa Catarina,Brazil` · `Palhoca,State of Santa Catarina,Brazil` · `Biguacu,State of Santa Catarina,Brazil`
**Balneário Camboriú e região:** `Balneario Camboriu,State of Santa Catarina,Brazil` · `Itajai,State of Santa Catarina,Brazil` · `Camboriu,State of Santa Catarina,Brazil` · `Itapema,State of Santa Catarina,Brazil`
**Distrito Federal (District):** `Brasilia,Federal District,Brazil` (City) · `Taguatinga, Federal District,Federal District,Brazil` · `Aguas Claras, Federal District,Federal District,Brazil` · `Samambaia,Federal District,Brazil` · `Sobradinho,Federal District,Brazil` · `Planaltina,Federal District,Brazil` · `Santa Maria,Federal District,Brazil` · `Asa Sul,Federal District,Brazil`
- **Não existem:** Ceilândia, Gama, Lago Sul, Vicente Pires, Recanto das Emas.
**Goiânia e região:** `Goiania,State of Goias,Brazil` · `Aparecida de Goiania,State of Goias,Brazil` · `Senador Canedo,State of Goias,Brazil` · `Trindade,State of Goias,Brazil`
**Cuiabá e região:** `Cuiaba,State of Mato Grosso,Brazil` · `Varzea Grande,State of Mato Grosso,Brazil`

DDD esperado: SP capital/ABC/Grande SP 11 · Baixada 13 · Campinas e região 19 · Curitiba 41 · Florianópolis 48 · Balneário Camboriú 47 · DF 61 · Goiânia 62 · Cuiabá 65.
