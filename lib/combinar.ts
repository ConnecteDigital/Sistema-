// Junta várias rodadas num relatório só, sem repetir anunciante, e compara os horários. Pura.
import { forcaDe, type Limites, type Organico } from "./agregacao";

export type LinhaRodada = {
  id: number; advertiser_id: number; aparicoes: number; buscas: number; presenca: number; pontos: string[]; termos: string[];
  pos_media: number | null; pct_topo: number; pct_sitelinks: number; titulo: string | null; link: string | null;
  forca: string; nome: string | null; duplicado_mesma_busca: number; termo_no_site?: boolean | null; termos_ausentes?: string[];
  advertisers: { dominio: string; nome: string | null }; regions: { nome: string };
  por_rodada?: { rodada: number; presenca: number | null }[];
  org_buscas?: number | null; org_aparicoes?: number | null; org_presenca?: number | null;
  org_pos_media?: number | null; org_melhor_pos?: number | null;
};

/** Orgânico da linha do banco (null = não medido). */
export function organicoDaLinha(l: LinhaRodada): Organico | null {
  if (l.org_buscas === null || l.org_buscas === undefined || !Number(l.org_buscas)) return null;
  return {
    buscas: Number(l.org_buscas), aparicoes: Number(l.org_aparicoes ?? 0), presenca: Number(l.org_presenca ?? 0),
    posMedia: l.org_pos_media === null || l.org_pos_media === undefined ? null : Number(l.org_pos_media),
    melhorPos: l.org_melhor_pos === null || l.org_melhor_pos === undefined ? null : Number(l.org_melhor_pos),
  };
}

export function combinarRodadas(rodadas: { rodada: number; linhas: LinhaRodada[] }[], limites: Limites): LinhaRodada[] {
  const ordem = [...rodadas].sort((a, b) => a.rodada - b.rodada);
  // total de buscas por rodada × região (igual em todas as linhas da região)
  const totais = new Map<string, number>();
  for (const r of ordem) for (const l of r.linhas) totais.set(`${r.rodada}|${l.regions.nome}`, Number(l.buscas));

  const grupos = new Map<string, { rodada: number; l: LinhaRodada }[]>();
  for (const r of ordem) for (const l of r.linhas) {
    const k = `${l.advertiser_id}|${l.regions.nome}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push({ rodada: r.rodada, l });
  }

  const saida: LinhaRodada[] = [];
  for (const itens of grupos.values()) {
    const regiao = itens[0].l.regions.nome;
    const ultima = itens[itens.length - 1].l;
    const ap = itens.reduce((s, x) => s + x.l.aparicoes, 0);
    const buscas = ordem.reduce((s, r) => s + (totais.get(`${r.rodada}|${regiao}`) ?? 0), 0);
    const presenca = buscas ? ap / buscas : 0;
    const peso = (f: (l: LinhaRodada) => number) => ap ? itens.reduce((s, x) => s + f(x.l) * x.l.aparicoes, 0) / ap : 0;
    const comPos = itens.filter((x) => x.l.pos_media !== null);
    const apPos = comPos.reduce((s, x) => s + x.l.aparicoes, 0);
    const falas = itens.map((x) => x.l.termo_no_site).filter((v) => v !== null && v !== undefined);
    // orgânico: soma só as rodadas em que foi medido
    const orgs = itens.map((x) => organicoDaLinha(x.l)).filter((o): o is Organico => !!o);
    const orgBuscas = orgs.reduce((s, o) => s + o.buscas, 0);
    const orgAp = orgs.reduce((s, o) => s + o.aparicoes, 0);
    const orgComPos = orgs.filter((o) => o.posMedia !== null && o.aparicoes > 0);
    const orgApPos = orgComPos.reduce((s, o) => s + o.aparicoes, 0);
    const melhores = orgs.map((o) => o.melhorPos).filter((p): p is number => p !== null);
    saida.push({
      ...ultima,
      aparicoes: ap, buscas, presenca, forca: forcaDe(presenca, limites),
      pontos: [...new Set(itens.flatMap((x) => x.l.pontos))].sort(),
      termos: [...new Set(itens.flatMap((x) => x.l.termos))].sort(),
      pos_media: apPos ? comPos.reduce((s, x) => s + Number(x.l.pos_media) * x.l.aparicoes, 0) / apPos : null,
      pct_topo: peso((l) => Number(l.pct_topo)), pct_sitelinks: peso((l) => Number(l.pct_sitelinks)),
      nome: itens.map((x) => x.l.nome).find(Boolean) ?? null,
      duplicado_mesma_busca: itens.reduce((s, x) => s + x.l.duplicado_mesma_busca, 0),
      termo_no_site: falas.includes(true) ? true : falas.includes(false) ? false : null,
      termos_ausentes: [...new Set(itens.flatMap((x) => x.l.termos_ausentes ?? []))],
      org_buscas: orgBuscas || null, org_aparicoes: orgBuscas ? orgAp : null,
      org_presenca: orgBuscas ? orgAp / orgBuscas : null,
      org_pos_media: orgApPos ? orgComPos.reduce((s, o) => s + o.posMedia! * o.aparicoes, 0) / orgApPos : null,
      org_melhor_pos: melhores.length ? Math.min(...melhores) : null,
      por_rodada: ordem.map((r) => {
        const x = itens.find((i) => i.rodada === r.rodada);
        if (x) return { rodada: r.rodada, presenca: Number(x.l.presenca) };
        return { rodada: r.rodada, presenca: totais.has(`${r.rodada}|${regiao}`) ? 0 : null };
      }),
    });
  }
  return saida;
}

export type Comparacao = "todas" | "so_primeira" | "so_ultima" | "sumiu" | "caiu" | "subiu";

/** Classifica como o anunciante se comportou entre a primeira e a última rodada. */
export function comparar(por: { rodada: number; presenca: number | null }[]): Comparacao[] {
  const v = por.filter((p) => p.presenca !== null) as { rodada: number; presenca: number }[];
  if (v.length < 2) return [];
  const prim = v[0].presenca, ult = v[v.length - 1].presenca;
  const out: Comparacao[] = [];
  if (v.every((p) => p.presenca > 0)) out.push("todas");
  if (prim > 0 && v.slice(1).every((p) => p.presenca === 0)) out.push("so_primeira");
  if (ult > 0 && v.slice(0, -1).every((p) => p.presenca === 0)) out.push("so_ultima");
  if (prim > 0 && ult === 0) out.push("sumiu");
  if (prim > 0 && ult > 0 && prim - ult >= 0.3) out.push("caiu");
  if (ult - prim >= 0.3 && prim > 0) out.push("subiu");
  return out;
}
