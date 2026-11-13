import "server-only";
import { db } from "./supabase";
import { agruparDonos } from "./grupos";
import type { ResultadoCnpj } from "./consulta-cnpj";
import type { Linha } from "./linha";
import { combinarRodadas, organicoDaLinha, type LinhaRodada } from "./combinar";
import { lerSettings } from "./motor";

export type { Linha } from "./linha";

const BASE = "id, advertiser_id, aparicoes, buscas, presenca, pontos, termos, pos_media, pct_topo, pct_sitelinks, titulo, link, forca, nome, duplicado_mesma_busca, advertisers(dominio, nome), regions(nome)";

const ORG = "org_buscas, org_aparicoes, org_presenca, org_pos_media, org_melhor_pos";

/** Linhas da rodada. Funciona mesmo se o 0006 (palavra-chave errada) ainda não foi rodado no banco. */
export async function buscarLinhasBanco(runId: number): Promise<LinhaBanco[]> {
  const org = await db().from("run_advertisers").select(BASE + ", termo_no_site, termos_ausentes, " + ORG).eq("run_id", runId).limit(5000);
  if (!org.error) return (org.data ?? []) as unknown as LinhaBanco[];
  // banco sem o 0013 (orgânico): segue sem
  const com = await db().from("run_advertisers").select(BASE + ", termo_no_site, termos_ausentes").eq("run_id", runId).limit(5000);
  if (!com.error) return (com.data ?? []) as unknown as LinhaBanco[];
  const sem = await db().from("run_advertisers").select(BASE).eq("run_id", runId).limit(5000);
  if (sem.error) throw new Error(sem.error.message);
  return (sem.data ?? []) as unknown as LinhaBanco[];
}

export type LinhaBanco = LinhaRodada;

/** Junta anunciantes da rodada com lead, site e CNPJ, e agrupa por dono. */
export async function montarLinhas(listaA: LinhaBanco[], pronta: boolean): Promise<Linha[]> {
  const advIds = [...new Set(listaA.map((a) => a.advertiser_id))];
  const [leads, sites, cnpjs] = advIds.length ? await Promise.all([
    db().from("leads").select("id, advertiser_id, prioridade, telefone_principal, outros_telefones, observacoes, status, cnpj, razao_social").in("advertiser_id", advIds),
    db().from("site_checks_recentes").select("advertiser_id, situacao, tag_google, tags_aw").in("advertiser_id", advIds),
    db().from("consultas_cnpj").select("advertiser_id, resultado, consultado_em").in("advertiser_id", advIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const leadPor = new Map((leads.data ?? []).map((l) => [l.advertiser_id, l]));
  const sitePor = new Map((sites.data ?? []).map((c) => [c.advertiser_id, c]));
  const cnpjPor = new Map((cnpjs.data ?? []).map((c) => [c.advertiser_id, c]));

  const linhas: Linha[] = listaA.map((a) => ({
    id: a.id, regiao: a.regions.nome, dominio: a.advertisers.dominio, nome: a.nome ?? a.advertisers.nome,
    aparicoes: a.aparicoes, buscas: a.buscas, presenca: Number(a.presenca), pontos: a.pontos, termos: a.termos,
    pos_media: a.pos_media === null ? null : Number(a.pos_media), pct_topo: Number(a.pct_topo),
    pct_sitelinks: Number(a.pct_sitelinks), titulo: a.titulo, link: a.link, forca: a.forca, duplicado: a.duplicado_mesma_busca,
    advertiserId: a.advertiser_id, leadId: leadPor.get(a.advertiser_id)?.id ?? null,
    prioridade: leadPor.get(a.advertiser_id)?.prioridade ?? null,
    telefone: leadPor.get(a.advertiser_id)?.telefone_principal ?? null,
    outrosTelefones: leadPor.get(a.advertiser_id)?.outros_telefones ?? [],
    observacoes: pronta ? (leadPor.get(a.advertiser_id)?.observacoes ?? []) : [],
    situacao: sitePor.get(a.advertiser_id)?.situacao ?? null, tagGoogle: sitePor.get(a.advertiser_id)?.tag_google ?? null,
    cnpj: cnpjPor.get(a.advertiser_id) ? { resultado: cnpjPor.get(a.advertiser_id)!.resultado, consultado_em: cnpjPor.get(a.advertiser_id)!.consultado_em } : null,
    cnpjPrincipal: leadPor.get(a.advertiser_id)?.cnpj ?? null,
    razaoSocial: leadPor.get(a.advertiser_id)?.razao_social ?? null,
    cnpjs: ((cnpjPor.get(a.advertiser_id)?.resultado as ResultadoCnpj | undefined)?.encontrados ?? []).map((x) => x.cnpj.replace(/\D/g, "")),
    tags: sitePor.get(a.advertiser_id)?.tags_aw ?? [],
    statusLead: leadPor.get(a.advertiser_id)?.status ?? null,
    grupo: a.advertiser_id,
    termoNoSite: a.termo_no_site ?? null, termosAusentes: a.termos_ausentes ?? [],
    porRodada: a.por_rodada,
    organico: organicoDaLinha(a),
  }));
  const grupos = agruparDonos([...new Map(linhas.map((l) => [l.advertiserId, l])).values()].map((l) => ({
    id: l.advertiserId, cnpjs: l.cnpjs, telefones: [l.telefone, ...l.outrosTelefones].filter((t): t is string => !!t), tags: l.tags,
  })));
  for (const l of linhas) l.grupo = grupos.get(l.advertiserId) ?? l.advertiserId;
  return linhas;
}

/** Carrega a rodada inteira (para relatório e exportação). */
export async function carregarRodada(id: number) {
  const { data: run } = await db().from("runs").select("id, criado_em, termos, status, total_buscas").eq("id", id).maybeSingle();
  if (!run) return null;
  const linhas = await montarLinhas(await buscarLinhasBanco(id), run.status === "pronta");
  return { run, linhas };
}

export type InfoRodada = { id: number; criado_em: string; termos: string[]; status: string; total_buscas: number };

/** Várias rodadas num relatório só: um anunciante por região, presença somada e comparação entre horários. */
export async function carregarRodadas(ids: number[]) {
  const unicos = [...new Set(ids)].filter(Number.isInteger).sort((a, b) => a - b);
  const { data: runs } = await db().from("runs").select("id, criado_em, termos, status, total_buscas").in("id", unicos);
  const infos = ((runs ?? []) as InfoRodada[]).sort((a, b) => a.id - b.id);
  if (!infos.length) return null;
  const porRodada = await Promise.all(infos.map(async (r) => ({ rodada: r.id, linhas: await buscarLinhasBanco(r.id) })));
  const linhasBanco = infos.length === 1
    ? porRodada[0].linhas
    : combinarRodadas(porRodada, (await lerSettings()).limites);
  const linhas = await montarLinhas(linhasBanco, infos.every((r) => r.status === "pronta"));
  return { runs: infos, linhas };
}
