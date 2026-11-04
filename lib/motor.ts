import "server-only";
import { db } from "./supabase";
import { descriptografar } from "./crypto";
import { buscarAnuncios, consultarConta } from "./serpapi";
import { identificarAnunciante } from "./dominio";
import { agregar, type AdBruto, type BuscaOk, type Limites } from "./agregacao";

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------
export async function lerSettings() {
  const { data } = await db().from("settings").select("chave, valor");
  const m = new Map((data ?? []).map((s) => [s.chave, s.valor]));
  return {
    limites: (m.get("forca_limites") as Limites) ?? { fraca_ate: 0.4, forte_acima: 0.75 },
    paralelo: Math.max(1, Math.min(10, Number(m.get("buscas_em_paralelo") ?? 6))),
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
  terminou: boolean;
};

export async function progresso(runId: number): Promise<Progresso> {
  const contar = (status: string) => db().from("run_searches").select("id", { count: "exact", head: true })
    .eq("run_id", runId).eq("status", status);
  const [run, ok, erro, anunc] = await Promise.all([
    db().from("runs").select("status, total_buscas, erro").eq("id", runId).single(),
    contar("ok"), contar("erro"),
    db().from("run_advertisers").select("id", { count: "exact", head: true }).eq("run_id", runId),
  ]);
  if (run.error || !run.data) {
    // Erro de leitura NÃO é "rodada terminada": mostra o motivo (ex.: falta rodar migration no banco)
    return {
      status: "desconhecido", total: 0, feitas: ok.count ?? 0, erros: erro.count ?? 0, anunciantes: 0,
      erro: "Erro ao ler a rodada no banco: " + (run.error?.message ?? "não encontrada") +
        ". Se falar de coluna/função que não existe, rode o 0003_motor.sql no Supabase.",
      terminou: false,
    };
  }
  const status = run.data.status;
  return {
    status, total: run.data.total_buscas ?? 0, feitas: ok.count ?? 0, erros: erro.count ?? 0,
    anunciantes: anunc.count ?? 0, erro: run.data.erro ?? null,
    terminou: status === "pronta" || status === "erro",
  };
}

export async function processarLote(runId: number): Promise<Progresso> {
  const { data: run } = await db().from("runs").select("status, erro").eq("id", runId).single();
  if (!run) throw new Error("Rodada não encontrada.");
  if (run.status === "pronta" || run.status === "erro") return progresso(runId);

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
  }));
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await db().from("run_advertisers")
      .upsert(linhas.slice(i, i + 500), { onConflict: "run_id,region_id,advertiser_id" });
    if (error) throw new Error(error.message);
  }

  await db().from("runs").update({
    status: "pronta", buscas_ok: buscas.length, creditos_usados: buscas.length, finalizada_em: agora, erro: null,
  }).eq("id", runId);

  // Saldo real das chaves (grátis)
  await atualizarCreditosAtivos().catch(() => {});
}
