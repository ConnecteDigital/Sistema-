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
