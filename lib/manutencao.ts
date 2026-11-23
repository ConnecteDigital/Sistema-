import "server-only";
import { db } from "./supabase";
import { PLATAFORMAS, identificarAnunciante } from "./dominio";
import { atualizarAnaliseDaRodada, gerarLeads, reagregar, verificarSite } from "./motor";

/**
 * Corrige anunciantes que foram agrupados pelo domínio da plataforma (ex.: todos os sites "*.lovable.app"
 * viraram um só "lovable.app"): recalcula o domínio de cada anúncio, refaz as rodadas afetadas e
 * apaga o anunciante misturado.
 */
export async function corrigirPlataformas(): Promise<{ sites: string[]; rodadas: number[]; anuncios: number }> {
  const { data: advs, error } = await db().from("advertisers").select("id, dominio").in("dominio", PLATAFORMAS);
  if (error) throw new Error(error.message);
  if (!advs?.length) return { sites: [], rodadas: [], anuncios: 0 };
  const advIds = advs.map((a) => a.id);

  // 1) recalcula o domínio de cada anúncio bruto
  type Ad = { id: number; link: string | null; displayed_link: string | null; source: string | null; dominio: string };
  const ads: Ad[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await db().from("ads_raw").select("id, link, displayed_link, source, dominio")
      .in("dominio", advs.map((a) => a.dominio)).order("id").range(de, de + 999);
    ads.push(...((data ?? []) as Ad[]));
    if (!data || data.length < 1000) break;
  }
  const porNovo = new Map<string, number[]>();
  for (const a of ads) {
    const novo = identificarAnunciante(a)?.dominio;
    if (novo && novo !== a.dominio) {
      if (!porNovo.has(novo)) porNovo.set(novo, []);
      porNovo.get(novo)!.push(a.id);
    }
  }
  for (const [dominio, ids] of porNovo) {
    for (let i = 0; i < ids.length; i += 200) await db().from("ads_raw").update({ dominio }).in("id", ids.slice(i, i + 200));
  }

  // 2) rodadas afetadas: refaz a agregação (sites, CNPJ e leads seguem ao abrir a rodada)
  const { data: ra } = await db().from("run_advertisers").select("run_id").in("advertiser_id", advIds).limit(10000);
  const rodadas = [...new Set((ra ?? []).map((r) => r.run_id as number))].sort((a, b) => a - b);
  for (const r of rodadas) await reagregar(r);

  // 3) apaga o anunciante misturado (e o lead/consultas dele, que misturavam empresas)
  await db().from("advertisers").delete().in("id", advIds);

  return { sites: [...porNovo.keys()].sort(), rodadas, anuncios: ads.length };
}

/**
 * Atualiza as rodadas antigas com a presença por cidade e a nova leitura do site (ramos parecidos).
 * Faz até `porVez` rodadas por clique (para não estourar o tempo) e diz quantas faltam.
 */
export async function atualizarRodadasAntigas(porVez = 4): Promise<{ feitas: number[]; faltam: number }> {
  const { data, error } = await db().from("run_advertisers").select("run_id").is("por_ponto", null).limit(10000);
  if (error) throw new Error(/por_ponto/.test(error.message) ? "Rode antes o 0014_presenca_por_cidade.sql no Supabase." : error.message);
  const pendentes = [...new Set((data ?? []).map((r) => r.run_id as number))].sort((a, b) => b - a);
  const feitas: number[] = [];
  for (const runId of pendentes.slice(0, porVez)) {
    await atualizarAnaliseDaRodada(runId);
    feitas.push(runId);
  }
  return { feitas, faltam: Math.max(0, pendentes.length - feitas.length) };
}

// "Fora do ar" que NÃO tem prova firme (regra antiga): tudo que não for domínio à venda/expirado ou DNS confirmado.
// (Não usa data: qualquer verificação antiga que escapou volta para a lista.)
const SITUACOES_A_REVER = ["fora_do_ar", "dns"];
type Consulta = { not: (c: string, op: string, v: string) => Consulta };
const semProvaFirme = <T,>(q: T) => (q as unknown as Consulta)
  .not("motivo", "ilike", "Domínio estacionado%")
  .not("motivo", "ilike", "%confirmado no DNS%") as unknown as T;

/** Quantos sites foram marcados "fora do ar" pela regra antiga e precisam ser conferidos de novo. */
export async function contarFalsosForaDoAr(): Promise<number> {
  const { count, error } = await semProvaFirme(db().from("site_checks_recentes").select("advertiser_id", { count: "exact", head: true })
    .in("situacao", SITUACOES_A_REVER));
  return error ? 0 : (count ?? 0);
}

/**
 * Reverifica esses sites com a regra nova e refaz os leads das rodadas deles (prioridade e observações).
 * Status, responsável e notas dos leads não mudam. Faz `porVez` sites por clique.
 */
export async function reverificarFalsosForaDoAr(porVez = 16): Promise<{ verificados: number; abriram: string[]; faltam: number }> {
  type C = { advertiser_id: number; url: string; advertisers: { dominio: string } };
  const { data, error } = await semProvaFirme(db().from("site_checks_recentes").select("advertiser_id, url, advertisers(dominio)")
    .in("situacao", SITUACOES_A_REVER)).limit(1000);
  if (error) throw new Error(error.message);
  const lista = (data ?? []) as unknown as C[];
  const agora = lista.slice(0, porVez);
  for (let i = 0; i < agora.length; i += 8) {
    await Promise.all(agora.slice(i, i + 8).map((c) => verificarSite(c.advertiser_id, c.advertisers.dominio, c.url).catch(() => {})));
  }
  const ids = agora.map((c) => c.advertiser_id);
  const { data: novos } = ids.length
    ? await db().from("site_checks_recentes").select("advertiser_id, situacao, advertisers(dominio)").in("advertiser_id", ids)
    : { data: [] };
  const abriram = ((novos ?? []) as unknown as { situacao: string; advertisers: { dominio: string } }[])
    .filter((n) => n.situacao === "ok").map((n) => n.advertisers.dominio);
  // refaz prioridade/observações nas rodadas desses anunciantes
  const { data: ls } = ids.length ? await db().from("leads").select("ultima_rodada").in("advertiser_id", ids) : { data: [] };
  const rodadas = [...new Set((ls ?? []).map((l) => l.ultima_rodada as number | null).filter((x): x is number => !!x))];
  for (const r of rodadas) await gerarLeads(r);
  return { verificados: agora.length, abriram, faltam: Math.max(0, lista.length - agora.length) };
}

// Prioridade v2 (força onde anuncia + só "Alta" com sinal concreto). Marca até qual rodada já foi refeita.
const CHAVE_PRIORIDADE = "prioridade_v2_ate";

export async function rodadasSemPrioridadeNova(): Promise<number[]> {
  const { data: m } = await db().from("settings").select("valor").eq("chave", CHAVE_PRIORIDADE).maybeSingle();
  const ate = Number(m?.valor ?? 0);
  const { data } = await db().from("runs").select("id").eq("status", "pronta").gt("id", ate).order("id").limit(1000);
  return (data ?? []).map((r) => r.id as number);
}

/** Refaz os leads de algumas rodadas (da mais antiga para a mais nova, para a última valer). Status/notas não mudam. */
export async function recalcularPrioridades(porVez = 3): Promise<{ feitas: number[]; faltam: number }> {
  const pendentes = await rodadasSemPrioridadeNova();
  const feitas: number[] = [];
  for (const r of pendentes.slice(0, porVez)) {
    await gerarLeads(r);
    await db().from("settings").upsert({ chave: CHAVE_PRIORIDADE, valor: r }, { onConflict: "chave" });
    feitas.push(r);
  }
  return { feitas, faltam: pendentes.length - feitas.length };
}
