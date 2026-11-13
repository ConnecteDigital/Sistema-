import "server-only";
import { db } from "./supabase";
import { descriptografar } from "./crypto";
import { buscarAnuncios, consultarConta, type OrganicoSerpApi } from "./serpapi";
import { identificarAnunciante } from "./dominio";
import { agregar, agregarOrganico, organicoDe, type AdBruto, type BuscaOk, type Limites, type OrgBruto } from "./agregacao";
import { analisarPagina, baixarPagina } from "./site";
import { dominioRaiz, hostDe } from "./dominio";
import { avaliarLead, montarContexto, type PresencaRegiao, type SiteResumo } from "./regras";
import { consultarCnpjDoSite, type ResultadoCnpj } from "./consulta-cnpj";
import { soDigitos } from "./cnpj";
import { avaliarTermos } from "./palavra";

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------
export async function lerSettings() {
  const { data } = await db().from("settings").select("chave, valor");
  const m = new Map((data ?? []).map((s) => [s.chave, s.valor]));
  return {
    limites: (m.get("forca_limites") as Limites) ?? { fraca_ate: 0.4, forte_acima: 0.75 },
    paralelo: Math.max(1, Math.min(10, Number(m.get("buscas_em_paralelo") ?? 6))),
    reverificarDias: Math.max(0, Number(m.get("reverificar_site_dias") ?? 7)),
  };
}

// ---------------------------------------------------------------------------
// Chaves SerpApi
// ---------------------------------------------------------------------------
type ChavePool = { id: number; apiKey: string; restantes: number; limite: number; usada: boolean };

async function carregarChaves(): Promise<ChavePool[]> {
  const { data, error } = await db().from("serp_keys")
    .select("id, chave_criptografada, creditos_restantes, limite_troca").eq("ativa", true);
  if (error) throw new Error(error.message);
  return (data ?? []).map((k) => ({
    id: k.id, apiKey: descriptografar(k.chave_criptografada),
    restantes: k.creditos_restantes ?? 0, limite: k.limite_troca ?? 2, usada: false,
  }));
}

/** Créditos utilizáveis = soma de (restantes - limite de troca) das chaves ativas. */
export async function atualizarCreditosAtivos(): Promise<{ total: number; utilizaveis: number }> {
  const chaves = await carregarChaves();
  let total = 0, utilizaveis = 0;
  await Promise.all(chaves.map(async (k) => {
    try {
      const c = await consultarConta(k.apiKey);
      k.restantes = c.creditosRestantes ?? 0;
      await db().from("serp_keys").update({
        creditos_restantes: c.creditosRestantes, uso_mes: c.usoMes, buscas_por_mes: c.buscasPorMes,
        plano: c.plano, limite_por_hora: c.limitePorHora, erro: null, verificada_em: new Date().toISOString(),
      }).eq("id", k.id);
    } catch (e) {
      await db().from("serp_keys").update({ erro: e instanceof Error ? e.message : String(e) }).eq("id", k.id);
    }
    total += k.restantes;
    utilizaveis += Math.max(0, k.restantes - k.limite);
  }));
  return { total, utilizaveis };
}

function escolherChave(pool: ChavePool[]): ChavePool | null {
  return pool.filter((k) => k.restantes > k.limite).sort((a, b) => b.restantes - a.restantes)[0] ?? null;
}

// ---------------------------------------------------------------------------
// Criar rodada
// ---------------------------------------------------------------------------
export async function criarRodada(termos: string[], locationIds: number[]) {
  const termosLimpos = [...new Set(termos.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
  const ids = [...new Set(locationIds)].slice(0, 300);
  if (!termosLimpos.length) throw new Error("Escolha pelo menos uma palavra-chave.");
  if (!ids.length) throw new Error("Escolha pelo menos um ponto.");

  const { data: locais, error: eLoc } = await db().from("locations")
    .select("id").in("id", ids).eq("ativo", true).not("validado_em", "is", null);
  if (eLoc) throw new Error(eLoc.message);
  const validos = (locais ?? []).map((l) => l.id);
  if (!validos.length) throw new Error("Nenhum dos pontos escolhidos está validado.");

  const total = termosLimpos.length * validos.length;
  const { utilizaveis } = await atualizarCreditosAtivos();
  if (utilizaveis < total) {
    throw new Error(`O plano precisa de ${total} buscas e você tem ${utilizaveis} créditos utilizáveis. ` +
      "Adicione uma chave em Configurações ou reduza o plano.");
  }

  const { data: run, error } = await db().from("runs")
    .insert({ termos: termosLimpos, total_buscas: total, status: "buscando" }).select("id").single();
  if (error) throw new Error(error.message);

  const linhas = validos.flatMap((location_id) => termosLimpos.map((termo) => ({ run_id: run.id, location_id, termo })));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error: e } = await db().from("run_searches").insert(linhas.slice(i, i + 500));
    if (e) throw new Error(e.message);
  }
  return run.id as number;
}

// ---------------------------------------------------------------------------
// Processar um lote (chamado repetidamente pela tela e, depois, pelo Cron)
// ---------------------------------------------------------------------------
export type Progresso = {
  status: string; total: number; feitas: number; erros: number; anunciantes: number; erro: string | null;
  terminou: boolean; sitesTotal: number; sitesVerificados: number; cnpjTotal: number; cnpjFeitos: number;
};

export async function progresso(runId: number): Promise<Progresso> {
  const contar = (status: string) => db().from("run_searches").select("id", { count: "exact", head: true })
    .eq("run_id", runId).eq("status", status);
  const [run, ok, erro, anunc] = await Promise.all([
    db().from("runs").select("status, total_buscas, erro, sites_total, sites_verificados, cnpj_total, cnpj_feitos").eq("id", runId).single(),
    contar("ok"), contar("erro"),
    db().from("run_advertisers").select("id", { count: "exact", head: true }).eq("run_id", runId),
  ]);
  if (run.error || !run.data) {
    // Erro de leitura NÃO é "rodada terminada": mostra o motivo (ex.: falta rodar migration no banco)
    return {
      status: "desconhecido", total: 0, feitas: ok.count ?? 0, erros: erro.count ?? 0, anunciantes: 0,
      erro: "Erro ao ler a rodada no banco: " + (run.error?.message ?? "não encontrada") +
        ". Se falar de coluna/função que não existe, rode o 0003_motor.sql no Supabase.",
      terminou: false, sitesTotal: 0, sitesVerificados: 0, cnpjTotal: 0, cnpjFeitos: 0,
    };
  }
  const status = run.data.status;
  return {
    status, total: run.data.total_buscas ?? 0, feitas: ok.count ?? 0, erros: erro.count ?? 0,
    anunciantes: anunc.count ?? 0, erro: run.data.erro ?? null,
    terminou: status === "pronta" || status === "erro",
    sitesTotal: run.data.sites_total ?? 0, sitesVerificados: run.data.sites_verificados ?? 0,
    cnpjTotal: run.data.cnpj_total ?? 0, cnpjFeitos: run.data.cnpj_feitos ?? 0,
  };
}

export async function processarLote(runId: number): Promise<Progresso> {
  const { data: run } = await db().from("runs").select("status, erro").eq("id", runId).single();
  if (!run) throw new Error("Rodada não encontrada.");
  if (run.status === "pronta" || run.status === "erro") return progresso(runId);
  if (run.status === "verificando") {
    await verificarSitesLote(runId);
    return progresso(runId);
  }

  const { paralelo } = await lerSettings();
  const pool = await carregarChaves();

  const { data: reservadas, error } = await db().rpc("reservar_buscas", { p_run_id: runId, p_limite: paralelo * 2 });
  if (error) throw new Error(error.message);
  const fila = [...((reservadas ?? []) as { id: number; location_id: number; termo: string; tentativas: number }[])];

  if (fila.length) {
    const { data: locs } = await db().from("locations").select("id, serpapi_canonical")
      .in("id", [...new Set(fila.map((f) => f.location_id))]);
    const canonical = new Map((locs ?? []).map((l) => [l.id, l.serpapi_canonical as string]));
    let semCredito: string | null = null;

    async function trabalhador() {
      for (let s = fila.shift(); s; s = fila.shift()) {
        if (semCredito) { await db().from("run_searches").update({ status: "pendente" }).eq("id", s.id); continue; }
        let feito = false;
        while (!feito) {
          const k = escolherChave(pool);
          if (!k) {
            semCredito = "Os créditos das chaves acabaram no meio da rodada. Adicione uma chave e clique em Continuar.";
            await db().from("run_searches").update({ status: "pendente" }).eq("id", s.id);
            break;
          }
          k.restantes--; k.usada = true;
          const r = await buscarAnuncios(k.apiKey, s.termo, canonical.get(s.location_id)!);
          if (r.tipo === "sem_creditos") {
            k.restantes = 0;
            await db().from("serp_keys").update({ creditos_restantes: 0, erro: r.msg }).eq("id", k.id);
            continue; // tenta a mesma busca com outra chave
          }
          if (r.tipo === "erro") {
            const tentativas = (s.tentativas ?? 0) + 1;
            await db().from("run_searches").update({
              status: tentativas >= 3 ? "erro" : "pendente", tentativas, erro: r.msg, serp_key_id: k.id,
            }).eq("id", s.id);
            feito = true;
            continue;
          }
          // ok: grava anúncios (apaga antes, para ser idempotente)
          await db().from("ads_raw").delete().eq("run_search_id", s.id);
          const linhas = r.anuncios.map((a) => {
            const ident = identificarAnunciante(a);
            return {
              run_search_id: s.id, position: a.position ?? null, block_position: a.block_position ?? null,
              title: a.title ?? null, link: a.link ?? null, displayed_link: a.displayed_link ?? null,
              source: a.source ?? null, dominio: ident?.dominio ?? null, sitelinks: a.sitelinks ?? null,
              extensions: a.extensions ?? null, rating: a.rating ?? null, reviews: a.reviews ?? null,
              tracking_link: a.tracking_link ?? null,
            };
          });
          if (linhas.length) await db().from("ads_raw").insert(linhas);
          await gravarOrganicos(s.id, r.organicos);
          await db().from("run_searches").update({
            status: "ok", serp_key_id: k.id, executada_em: new Date().toISOString(),
            location_usada: r.localUsado, qtd_anuncios: linhas.length, erro: null,
          }).eq("id", s.id);
          feito = true;
        }
      }
    }
    await Promise.all(Array.from({ length: paralelo }, trabalhador));

    // Salva o saldo estimado das chaves usadas
    await Promise.all(pool.filter((k) => k.usada).map((k) =>
      db().from("serp_keys").update({ creditos_restantes: Math.max(0, k.restantes) }).eq("id", k.id)));

    if (semCredito) {
      await db().from("runs").update({ erro: semCredito }).eq("id", runId);
      return progresso(runId);
    }
    if (run.erro) await db().from("runs").update({ erro: null }).eq("id", runId);
  }

  // Ainda há buscas pendentes/executando?
  const { count } = await db().from("run_searches").select("id", { count: "exact", head: true })
    .eq("run_id", runId).in("status", ["pendente", "executando"]);
  if ((count ?? 0) > 0) {
    const { count: ok } = await db().from("run_searches").select("id", { count: "exact", head: true })
      .eq("run_id", runId).eq("status", "ok");
    await db().from("runs").update({ buscas_ok: ok ?? 0, creditos_usados: ok ?? 0 }).eq("id", runId);
    return progresso(runId);
  }

  await finalizar(runId);
  return progresso(runId);
}

/**
 * Grava os resultados orgânicos da busca (mesma resposta, sem crédito a mais).
 * Separado do status da busca de propósito: se o banco ainda não tiver o 0013, a rodada segue sem orgânico.
 */
async function gravarOrganicos(runSearchId: number, organicos: OrganicoSerpApi[] | null) {
  try {
    await db().from("organic_raw").delete().eq("run_search_id", runSearchId);
    const linhas = (organicos ?? []).flatMap((o) => {
      const host = hostDe(o.link) ?? hostDe(o.displayed_link);
      if (!host || /(^|\.)google\.[a-z.]+$/.test(host)) return [];
      return [{
        run_search_id: runSearchId, position: typeof o.position === "number" ? o.position : null,
        title: o.title ?? null, link: o.link ?? null, displayed_link: o.displayed_link ?? null,
        source: o.source ?? null, dominio: dominioRaiz(host),
      }];
    });
    if (linhas.length) await db().from("organic_raw").insert(linhas);
    await db().from("run_searches").update({ qtd_organicos: organicos ? linhas.length : null }).eq("id", runSearchId);
  } catch { /* orgânico é complemento: nunca trava a rodada */ }
}

/** Tenta de novo uma rodada parada (créditos acabaram): limpa o erro. */
export async function retomar(runId: number) {
  await db().from("runs").update({ erro: null }).eq("id", runId);
}

// ---------------------------------------------------------------------------
// Agregação final (idempotente: pode rodar duas vezes sem duplicar)
// ---------------------------------------------------------------------------
async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const saida: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw new Error(error.message);
    saida.push(...(data ?? []));
    if (!data || data.length < 1000) return saida;
  }
}

async function finalizar(runId: number) {
  const { limites } = await lerSettings();
  type LinhaBusca = { id: number; termo: string; locations: { region_id: number; nome_exibicao: string } };
  const buscas = await todas<LinhaBusca>((de, ate) => db().from("run_searches")
    .select("id, termo, locations(region_id, nome_exibicao)").eq("run_id", runId).eq("status", "ok")
    .order("id").range(de, ate) as never);
  type LinhaAd = { run_search_id: number; dominio: string | null; position: number | null; block_position: string | null;
    title: string | null; link: string | null; source: string | null; sitelinks: unknown };
  const ads = await todas<LinhaAd>((de, ate) => db().from("ads_raw")
    .select("run_search_id, dominio, position, block_position, title, link, source, sitelinks, run_searches!inner(run_id)")
    .eq("run_searches.run_id", runId).order("id").range(de, ate) as never);
  const { data: bl } = await db().from("blocklist").select("dominio");

  const buscasOk: BuscaOk[] = buscas.map((b) => ({
    id: b.id, termo: b.termo, regionId: b.locations.region_id, ponto: b.locations.nome_exibicao,
  }));
  const adsBrutos: AdBruto[] = ads.filter((a) => a.dominio).map((a) => ({
    runSearchId: a.run_search_id, dominio: a.dominio!, position: a.position, block: a.block_position,
    title: a.title, link: a.link, source: a.source,
    temSitelinks: Array.isArray(a.sitelinks) ? a.sitelinks.length > 0 : !!(a.sitelinks && Object.keys(a.sitelinks as object).length),
  }));
  const agregados = agregar(buscasOk, adsBrutos, limites, new Set((bl ?? []).map((b) => b.dominio)));
  const organico = await lerOrganicoDaRodada(runId, buscasOk);

  // Anunciantes (únicos por domínio)
  const agora = new Date().toISOString();
  const porDominio = new Map<string, string | null>();
  for (const a of agregados) if (!porDominio.has(a.dominio) || !porDominio.get(a.dominio)) porDominio.set(a.dominio, a.nome);
  const idPorDominio = new Map<string, number>();
  const lista = [...porDominio].map(([dominio, nome]) => ({ dominio, nome, ultimo_visto: agora }));
  for (let i = 0; i < lista.length; i += 500) {
    const { data, error } = await db().from("advertisers").upsert(lista.slice(i, i + 500), { onConflict: "dominio" })
      .select("id, dominio");
    if (error) throw new Error(error.message);
    for (const a of data ?? []) idPorDominio.set(a.dominio, a.id);
  }

  const linhas = agregados.map((a) => ({
    run_id: runId, region_id: a.regionId, advertiser_id: idPorDominio.get(a.dominio)!, nome: a.nome,
    aparicoes: a.aparicoes, buscas: a.buscas, presenca: Number(a.presenca.toFixed(4)), pontos: a.pontos,
    termos: a.termos, pos_media: a.posMedia === null ? null : Number(a.posMedia.toFixed(2)),
    pct_topo: Number(a.pctTopo.toFixed(4)), pct_sitelinks: Number(a.pctSitelinks.toFixed(4)),
    titulo: a.titulo, link: a.link, forca: a.forca, duplicado_mesma_busca: a.duplicadoMesmaBusca,
    ...(organico ? camposOrganico(organicoDe(a.regionId, a.dominio, organico)) : {}),
  }));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db().from("run_advertisers")
      .upsert(linhas.slice(i, i + 500), { onConflict: "run_id,region_id,advertiser_id" });
    if (error) throw new Error(error.message);
  }

  // Próxima etapa: verificar os sites (Fase 3)
  await db().from("runs").update({
    status: "verificando", buscas_ok: buscas.length, creditos_usados: buscas.length, erro: null,
  }).eq("id", runId);

  // Saldo real das chaves (grátis)
  await atualizarCreditosAtivos().catch(() => {});
}

/** Orgânico da rodada. null = banco sem o 0013 (aí as colunas org_* nem são enviadas). */
async function lerOrganicoDaRodada(runId: number, buscasOk: BuscaOk[]) {
  try {
    type LinhaLida = { id: number; qtd_organicos: number | null };
    const lidasRaw = await todas<LinhaLida>((de, ate) => db().from("run_searches")
      .select("id, qtd_organicos").eq("run_id", runId).eq("status", "ok").not("qtd_organicos", "is", null)
      .order("id").range(de, ate) as never);
    type LinhaOrg = { run_search_id: number; dominio: string | null; position: number | null };
    const org = await todas<LinhaOrg>((de, ate) => db().from("organic_raw")
      .select("run_search_id, dominio, position, run_searches!inner(run_id)")
      .eq("run_searches.run_id", runId).order("id").range(de, ate) as never);
    const brutos: OrgBruto[] = org.filter((o) => o.dominio).map((o) => ({ runSearchId: o.run_search_id, dominio: o.dominio!, position: o.position }));
    return agregarOrganico(buscasOk, new Set(lidasRaw.map((l) => l.id)), brutos);
  } catch {
    return null;
  }
}

function camposOrganico(o: ReturnType<typeof organicoDe>) {
  if (!o) return { org_buscas: null, org_aparicoes: null, org_presenca: null, org_pos_media: null, org_melhor_pos: null };
  return {
    org_buscas: o.buscas, org_aparicoes: o.aparicoes, org_presenca: Number(o.presenca.toFixed(4)),
    org_pos_media: o.posMedia === null ? null : Number(o.posMedia.toFixed(2)), org_melhor_pos: o.melhorPos,
  };
}

// ---------------------------------------------------------------------------
// Fase 3: verificação de sites e geração de leads
// ---------------------------------------------------------------------------
type AnuncianteRodada = { advertiser_id: number; presenca: number; link: string | null; advertisers: { dominio: string } };

async function anunciantesDaRodada(runId: number) {
  const linhas = await todas<AnuncianteRodada>((de, ate) => db().from("run_advertisers")
    .select("advertiser_id, presenca, link, advertisers(dominio)").eq("run_id", runId).order("id").range(de, ate) as never);
  // um link por anunciante: o da região onde ele é mais forte
  const porId = new Map<number, { dominio: string; link: string | null; presenca: number }>();
  for (const l of linhas) {
    const atual = porId.get(l.advertiser_id);
    if (!atual || Number(l.presenca) > atual.presenca) {
      porId.set(l.advertiser_id, { dominio: l.advertisers.dominio, link: l.link, presenca: Number(l.presenca) });
    }
  }
  return porId;
}

function urlParaVerificar(dominio: string, link: string | null) {
  const host = hostDe(link);
  if (link && host && dominioRaiz(host) === dominio) return link;
  return `https://${dominio}/`;
}

export async function verificarSite(advertiserId: number, dominio: string, url: string) {
  const pagina = await baixarPagina(url);
  const a = analisarPagina(pagina);
  await db().from("site_checks").insert({
    advertiser_id: advertiserId, url, http_status: pagina.status, url_final: pagina.urlFinal,
    situacao: a.situacao, motivo: a.motivo, telefones: a.telefones.map((t) => t.formatado),
    whatsapps: a.whatsapps.map((t) => t.formatado), tags_aw: a.tagsAw, tags_gtm: a.tagsGtm, ga4: a.ga4,
    tamanho_html: pagina.html.length, tempo_ms: pagina.tempoMs, cnpjs: a.cnpjs, tag_google: a.tagGoogle, via: "proprio",
    texto: a.texto || null, texto_len: a.texto.length,
  });
}

async function verificarSitesLote(runId: number) {
  const { reverificarDias } = await lerSettings();
  const anunciantes = await anunciantesDaRodada(runId);
  const ids = [...anunciantes.keys()];
  const limite = Date.now() - reverificarDias * 86_400_000;

  const recentes = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db().from("site_checks_recentes").select("advertiser_id, verificado_em, texto_len")
      .in("advertiser_id", ids.slice(i, i + 300));
    if (error) throw new Error(error.message);
    // verificação antiga sem o texto do site (feita antes dos relatórios) conta como pendente
    for (const c of data ?? []) if (c.texto_len !== null) recentes.set(c.advertiser_id, c.verificado_em);
  }
  const verificaveis = ids.filter((id) => !anunciantes.get(id)!.dominio.startsWith("perfil-google:"));
  const pendentes = verificaveis.filter((id) => !recentes.has(id) || new Date(recentes.get(id)!).getTime() < limite);

  const LOTE = 8;
  if (pendentes.length) {
    await Promise.all(pendentes.slice(0, LOTE).map((id) => {
      const a = anunciantes.get(id)!;
      return verificarSite(id, a.dominio, urlParaVerificar(a.dominio, a.link)).catch(() => {});
    }));
    await db().from("runs").update({
      sites_total: verificaveis.length, sites_verificados: verificaveis.length - Math.max(0, pendentes.length - LOTE),
    }).eq("id", runId);
    return;
  }
  await db().from("runs").update({ sites_total: verificaveis.length, sites_verificados: verificaveis.length }).eq("id", runId);

  // Sites prontos → CNPJ automático → leads
  const cnpjTerminou = await consultarCnpjsLote(runId, anunciantes, verificaveis);
  if (cnpjTerminou) {
    await gerarLeads(runId);
    await db().from("runs").update({ status: "pronta", finalizada_em: new Date().toISOString() }).eq("id", runId);
  }
}

const CNPJ_VALIDO_DIAS = 30;

/** Consulta o CNPJ de quem ainda não tem consulta recente. Devolve true quando não sobrar nenhum. */
async function consultarCnpjsLote(
  runId: number, anunciantes: Map<number, { dominio: string; link: string | null }>, verificaveis: number[],
): Promise<boolean> {
  const limite = Date.now() - CNPJ_VALIDO_DIAS * 86_400_000;
  const feitos = new Set<number>();
  for (let i = 0; i < verificaveis.length; i += 300) {
    const { data, error } = await db().from("consultas_cnpj").select("advertiser_id, consultado_em")
      .in("advertiser_id", verificaveis.slice(i, i + 300));
    if (error) throw new Error(error.message);
    for (const c of data ?? []) if (new Date(c.consultado_em).getTime() >= limite) feitos.add(c.advertiser_id);
  }
  const pendentes = verificaveis.filter((id) => !feitos.has(id));
  const LOTE = 6;
  const lote = pendentes.slice(0, LOTE);

  if (lote.length) {
    const { data: sites } = await db().from("site_checks_recentes").select("advertiser_id, cnpjs").in("advertiser_id", lote);
    const cnpjsSite = new Map((sites ?? []).map((c) => [c.advertiser_id, (c.cnpjs ?? []) as string[]]));
    await Promise.all(lote.map(async (id) => {
      const a = anunciantes.get(id)!;
      let resultado: ResultadoCnpj;
      try {
        resultado = await Promise.race([
          consultarCnpjDoSite(a.dominio, a.link, { cnpjsDoSite: cnpjsSite.get(id) ?? [], paginasExtras: false }),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), 40_000)),
        ]);
      } catch (e) {
        resultado = { dominio: a.dominio, titularDominio: null, encontrados: [], empresas: [],
          avisos: [`Consulta automática falhou (${e instanceof Error ? e.message : e}). Use "consultar de novo".`] };
      }
      await db().from("consultas_cnpj").upsert(
        { advertiser_id: id, resultado, consultado_em: new Date().toISOString() }, { onConflict: "advertiser_id" });
    }));
  }
  await db().from("runs").update({
    cnpj_total: verificaveis.length, cnpj_feitos: verificaveis.length - Math.max(0, pendentes.length - lote.length),
  }).eq("id", runId);
  return pendentes.length <= lote.length;
}

type LinhaSite = {
  advertiser_id: number; situacao: string; motivo: string | null; telefones: string[]; whatsapps: string[];
  tag_google: string | null; tags_aw: string[]; tags_gtm: string[]; advertisers: { dominio: string };
};
const resumoSite = (c: LinhaSite): SiteResumo => ({
  situacao: c.situacao, motivo: c.motivo, telefones: c.telefones ?? [], whatsapps: c.whatsapps ?? [],
  tagGoogle: c.tag_google, tagsAw: c.tags_aw ?? [], tagsGtm: c.tags_gtm ?? [],
});

export async function gerarLeads(runId: number) {
  type L = { id: number; advertiser_id: number; presenca: number; forca: string; pct_sitelinks: number; duplicado_mesma_busca: number;
    termos: string[]; advertisers: { dominio: string }; regions: { nome: string; ddd: string } };
  const linhas = await todas<L>((de, ate) => db().from("run_advertisers")
    .select("id, advertiser_id, presenca, forca, pct_sitelinks, duplicado_mesma_busca, termos, advertisers(dominio), regions(nome, ddd)")
    .eq("run_id", runId).order("id").range(de, ate) as never);

  // Contexto global: últimas verificações dos últimos 90 dias (para achar redes e mesmo dono)
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const sites = await todas<LinhaSite>((de, ate) => db().from("site_checks_recentes")
    .select("advertiser_id, situacao, motivo, telefones, whatsapps, tag_google, tags_aw, tags_gtm, advertisers(dominio)")
    .gte("verificado_em", desde).order("advertiser_id").range(de, ate) as never);
  const sitePorId = new Map(sites.map((c) => [c.advertiser_id, c]));

  type LinhaCnpj = { advertiser_id: number; resultado: ResultadoCnpj; advertisers: { dominio: string } };
  const consultas = await todas<LinhaCnpj>((de, ate) => db().from("consultas_cnpj")
    .select("advertiser_id, resultado, advertisers(dominio)").gte("consultado_em", desde)
    .order("advertiser_id").range(de, ate) as never);
  const cnpjPorId = new Map(consultas.map((c) => [c.advertiser_id, {
    cnpjs: (c.resultado?.encontrados ?? []).map((x) => soDigitos(x.cnpj)),
    principal: c.resultado?.empresas?.[0]?.cnpj ?? c.resultado?.encontrados?.[0]?.cnpj ?? null,
    razao: c.resultado?.empresas?.[0]?.razaoSocial ?? null,
  }]));
  const ctx = montarContexto(
    sites.map((c) => ({ dominio: c.advertisers.dominio, site: resumoSite(c) })),
    consultas.map((c) => ({ dominio: c.advertisers.dominio, cnpjs: cnpjPorId.get(c.advertiser_id)!.cnpjs })),
  );

  // O site fala da palavra que anunciou? (por linha da rodada)
  const idsRodada = [...new Set(linhas.map((l) => l.advertiser_id))];
  const textoPorId = new Map<number, string | null>();
  for (let i = 0; i < idsRodada.length; i += 50) {
    const { data } = await db().from("site_checks_recentes").select("advertiser_id, situacao, texto")
      .in("advertiser_id", idsRodada.slice(i, i + 50));
    for (const c of data ?? []) textoPorId.set(c.advertiser_id, c.situacao === "ok" ? c.texto : null);
  }
  const palavraPorId = new Map<number, { algumOk: boolean; ausentes: Set<string>; verificado: boolean }>();
  const atualizacoes = linhas.map((l) => {
    const r = avaliarTermos(textoPorId.get(l.advertiser_id) ?? null, l.termos ?? []);
    const p = palavraPorId.get(l.advertiser_id) ?? { algumOk: false, ausentes: new Set<string>(), verificado: false };
    if (r.termoNoSite !== null) p.verificado = true;
    if (r.termoNoSite) p.algumOk = true;
    r.ausentes.forEach((t) => p.ausentes.add(t));
    palavraPorId.set(l.advertiser_id, p);
    return { id: l.id, termo_no_site: r.termoNoSite, termos_ausentes: r.ausentes };
  });
  for (let i = 0; i < atualizacoes.length; i += 20) {
    await Promise.all(atualizacoes.slice(i, i + 20).map((u) =>
      db().from("run_advertisers").update({ termo_no_site: u.termo_no_site, termos_ausentes: u.termos_ausentes }).eq("id", u.id)));
  }

  const grupos = new Map<number, { dominio: string; regioes: PresencaRegiao[] }>();
  for (const l of linhas) {
    if (!grupos.has(l.advertiser_id)) grupos.set(l.advertiser_id, { dominio: l.advertisers.dominio, regioes: [] });
    grupos.get(l.advertiser_id)!.regioes.push({
      regiao: l.regions.nome, ddd: l.regions.ddd, presenca: Number(l.presenca), forca: l.forca,
      pctSitelinks: Number(l.pct_sitelinks), duplicado: l.duplicado_mesma_busca,
    });
  }

  const agora = new Date().toISOString();
  const leads = [...grupos].map(([advertiserId, g]) => {
    const c = sitePorId.get(advertiserId);
    const cj = cnpjPorId.get(advertiserId);
    const pal = palavraPorId.get(advertiserId);
    const palavraErrada = pal?.verificado && !pal.algumOk ? [...pal.ausentes] : null;
    const r = avaliarLead({ dominio: g.dominio, regioes: g.regioes, site: c ? resumoSite(c) : null,
      cnpjs: cj?.cnpjs, razaoSocial: cj?.razao, palavraErrada }, ctx);
    return {
      advertiser_id: advertiserId, prioridade: r.prioridade, telefone_principal: r.telefonePrincipal,
      outros_telefones: r.outrosTelefones, observacoes: r.observacoes, forca: r.forca,
      presenca: Number(r.presenca.toFixed(4)), regioes: g.regioes.map((x) => x.regiao), ultima_rodada: runId,
      cnpj: cj?.principal ?? null, razao_social: cj?.razao ?? null, atualizado_em: agora,
    };
  });
  // upsert só dos campos automáticos: status, responsável, notas e data do contato ficam como estão
  for (let i = 0; i < leads.length; i += 500) {
    const { error } = await db().from("leads").upsert(leads.slice(i, i + 500), { onConflict: "advertiser_id" });
    if (error) throw new Error(error.message);
  }
}

/** Refaz a verificação de sites e os leads de uma rodada (ex.: rodadas feitas antes da Fase 3). */
export async function reprocessar(runId: number) {
  await db().from("runs").update({ status: "verificando", erro: null, finalizada_em: null }).eq("id", runId);
}

/** Refaz a agregação de uma rodada do zero (usado na correção de domínios) e segue para sites/CNPJ/leads. */
export async function reagregar(runId: number) {
  await db().from("run_advertisers").delete().eq("run_id", runId);
  await finalizar(runId);
}
