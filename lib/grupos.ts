// Agrupa anunciantes do mesmo dono (mesmo CNPJ, mesmo telefone ou mesma tag AW-). Pura.
export type ItemGrupo = { id: number; cnpjs: string[]; telefones: string[]; tags: string[] };

export function agruparDonos(itens: ItemGrupo[]): Map<number, number> {
  const pai = new Map<number, number>(itens.map((i) => [i.id, i.id]));
  const raiz = (x: number): number => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x)!)!); x = pai.get(x)!; } return x; };
  const unir = (a: number, b: number) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) pai.set(Math.max(ra, rb), Math.min(ra, rb)); };
  const vistos = new Map<string, number>();
  for (const i of itens) {
    const chaves = [
      ...i.cnpjs.map((c) => "c:" + c.replace(/\D/g, "")),
      ...i.telefones.map((t) => t.replace(/\D/g, "")).filter((t) => t.length >= 10 && !t.startsWith("0800")).map((t) => "t:" + t),
      ...i.tags.filter((t) => t.startsWith("AW-")).map((t) => "a:" + t),
    ];
    for (const k of chaves) {
      if (vistos.has(k)) unir(i.id, vistos.get(k)!); else vistos.set(k, i.id);
    }
  }
  return new Map(itens.map((i) => [i.id, raiz(i.id)]));
}
