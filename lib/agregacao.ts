// Agregação por região (seção 8.3) e força da presença (seção 8.4). Funções puras.

export type BuscaOk = { id: number; regionId: number; ponto: string; termo: string };
export type AdBruto = {
  runSearchId: number; dominio: string; position: number | null; block: string | null;
  title: string | null; link: string | null; source: string | null; temSitelinks: boolean;
};
export type Limites = { fraca_ate: number; forte_acima: number };

export type Agregado = {
  regionId: number; dominio: string; nome: string | null; aparicoes: number; buscas: number;
  presenca: number; pontos: string[]; termos: string[]; posMedia: number | null; pctTopo: number;
  pctSitelinks: number; titulo: string | null; link: string | null; forca: "Fraca" | "Média" | "Forte";
  duplicadoMesmaBusca: number;
};

export function forcaDe(presenca: number, l: Limites): "Fraca" | "Média" | "Forte" {
  if (presenca < l.fraca_ate) return "Fraca";
  if (presenca > l.forte_acima) return "Forte";
  return "Média";
}

function maisFrequente(valores: (string | null)[]): string | null {
  const c = new Map<string, number>();
  for (const v of valores) if (v) c.set(v, (c.get(v) ?? 0) + 1);
  let melhor: string | null = null, n = 0;
  for (const [v, k] of c) if (k > n) { melhor = v; n = k; }
  return melhor;
}

export function agregar(buscas: BuscaOk[], ads: AdBruto[], limites: Limites, bloqueados: Set<string>): Agregado[] {
  const buscaPorId = new Map(buscas.map((b) => [b.id, b]));
  const buscasPorRegiao = new Map<number, number>();
  for (const b of buscas) buscasPorRegiao.set(b.regionId, (buscasPorRegiao.get(b.regionId) ?? 0) + 1);

  const grupos = new Map<string, { regionId: number; dominio: string; ads: AdBruto[] }>();
  for (const ad of ads) {
    const b = buscaPorId.get(ad.runSearchId);
    if (!b || bloqueados.has(ad.dominio)) continue;
    const chave = `${b.regionId}|${ad.dominio}`;
    if (!grupos.has(chave)) grupos.set(chave, { regionId: b.regionId, dominio: ad.dominio, ads: [] });
    grupos.get(chave)!.ads.push(ad);
  }

  const saida: Agregado[] = [];
  for (const g of grupos.values()) {
    const porBusca = new Map<number, number>();
    for (const a of g.ads) porBusca.set(a.runSearchId, (porBusca.get(a.runSearchId) ?? 0) + 1);
    const combos = new Set<string>(), pontos = new Set<string>(), termos = new Set<string>();
    for (const id of porBusca.keys()) {
      const b = buscaPorId.get(id)!;
      combos.add(`${b.ponto}|${b.termo}`); pontos.add(b.ponto); termos.add(b.termo);
    }
    const buscasRegiao = buscasPorRegiao.get(g.regionId) ?? 0;
    const presenca = buscasRegiao ? combos.size / buscasRegiao : 0;
    const posicoes = g.ads.map((a) => a.position).filter((p): p is number => typeof p === "number");
    saida.push({
      regionId: g.regionId, dominio: g.dominio, nome: maisFrequente(g.ads.map((a) => a.source)),
      aparicoes: combos.size, buscas: buscasRegiao, presenca,
      pontos: [...pontos].sort(), termos: [...termos].sort(),
      posMedia: posicoes.length ? posicoes.reduce((s, p) => s + p, 0) / posicoes.length : null,
      pctTopo: g.ads.filter((a) => a.block === "top").length / g.ads.length,
      pctSitelinks: g.ads.filter((a) => a.temSitelinks).length / g.ads.length,
      titulo: maisFrequente(g.ads.map((a) => a.title)), link: maisFrequente(g.ads.map((a) => a.link)),
      forca: forcaDe(presenca, limites),
      duplicadoMesmaBusca: [...porBusca.values()].filter((n) => n > 1).length,
    });
  }
  return saida.sort((a, b) => a.regionId - b.regionId || b.presenca - a.presenca);
}

// ---------------------------------------------------------------------------
// Orgânico: em quantas buscas o site aparece na 1ª página (sem anúncio) e em que posição.
// ---------------------------------------------------------------------------
export type OrgBruto = { runSearchId: number; dominio: string; position: number | null };

export type Organico = {
  buscas: number;            // buscas da região em que o orgânico foi lido
  aparicoes: number;         // em quantas delas o site apareceu
  presenca: number;
  posMedia: number | null;   // média da melhor posição em cada busca em que apareceu
  melhorPos: number | null;
};

/**
 * Orgânico por região × domínio. `lidas` = ids das buscas em que a resposta trouxe o bloco orgânico
 * (só elas contam: busca sem o bloco não prova que o site não aparece).
 */
export function agregarOrganico(buscas: BuscaOk[], lidas: Set<number>, org: OrgBruto[]): {
  porChave: Map<string, Organico>; buscasPorRegiao: Map<number, number>;
} {
  const buscaPorId = new Map(buscas.map((b) => [b.id, b]));
  const buscasPorRegiao = new Map<number, number>();
  for (const b of buscas) if (lidas.has(b.id)) buscasPorRegiao.set(b.regionId, (buscasPorRegiao.get(b.regionId) ?? 0) + 1);

  // melhor posição de cada domínio em cada busca (o mesmo site pode aparecer 2x na mesma página)
  const melhor = new Map<string, { regionId: number; dominio: string; porBusca: Map<number, number | null> }>();
  for (const o of org) {
    const b = buscaPorId.get(o.runSearchId);
    if (!b || !lidas.has(b.id)) continue;
    const chave = `${b.regionId}|${o.dominio}`;
    if (!melhor.has(chave)) melhor.set(chave, { regionId: b.regionId, dominio: o.dominio, porBusca: new Map() });
    const g = melhor.get(chave)!;
    const atual = g.porBusca.get(b.id);
    if (!g.porBusca.has(b.id) || (o.position !== null && (atual === null || atual === undefined || o.position < atual))) {
      g.porBusca.set(b.id, o.position);
    }
  }

  const porChave = new Map<string, Organico>();
  for (const [chave, g] of melhor) {
    const total = buscasPorRegiao.get(g.regionId) ?? 0;
    const pos = [...g.porBusca.values()].filter((p): p is number => typeof p === "number");
    porChave.set(chave, {
      buscas: total, aparicoes: g.porBusca.size, presenca: total ? g.porBusca.size / total : 0,
      posMedia: pos.length ? pos.reduce((s, p) => s + p, 0) / pos.length : null,
      melhorPos: pos.length ? Math.min(...pos) : null,
    });
  }
  return { porChave, buscasPorRegiao };
}

/** Orgânico de um anunciante na região: medido e não encontrado = 0 aparições; não medido = null. */
export function organicoDe(regionId: number, dominio: string, r: ReturnType<typeof agregarOrganico>): Organico | null {
  const total = r.buscasPorRegiao.get(regionId) ?? 0;
  if (!total) return null;
  return r.porChave.get(`${regionId}|${dominio}`) ?? { buscas: total, aparicoes: 0, presenca: 0, posMedia: null, melhorPos: null };
}
