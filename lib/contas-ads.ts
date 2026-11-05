// Resumo da Central de Transparência: uma linha por conta do Google Ads. Puro.
import { dominioRaiz, hostDe } from "./dominio";
import type { ItemAds } from "./dataforseo";

export type ContaAds = {
  advertiserId: string; nome: string | null; verificado: boolean; anuncios: number;
  primeiroAnuncio: string | null; ultimoAnuncio: string | null; sites: string[];
  pareceEmpresa: boolean;     // nome com LTDA, ME, EIRELI, S/A… = conta em CNPJ; senão provável CPF (pessoa)
};
export type ResumoContas = { contas: ContaAds[]; outrosSites: string[] };

const EMPRESA = /\b(ltda|me|epp|eireli|s\.?\/?a\.?|servi[cç]os|com[eé]rcio|comercio|ind[uú]stria|empreendimentos|solu[cç][oõ]es|engenharia|desentupidora|hidr[aá]ulica)\b/i;

export function resumirContas(itens: ItemAds[], dominioOriginal: string): ResumoContas {
  const m = new Map<string, ContaAds>();
  for (const i of itens) {
    const id = i.advertiser_id!;
    const c = m.get(id) ?? { advertiserId: id, nome: i.title ?? null, verificado: !!i.verified, anuncios: 0,
      primeiroAnuncio: null, ultimoAnuncio: null, sites: [], pareceEmpresa: false };
    c.anuncios++;
    if (i.first_shown && (!c.primeiroAnuncio || i.first_shown < c.primeiroAnuncio)) c.primeiroAnuncio = i.first_shown;
    if (i.last_shown && (!c.ultimoAnuncio || i.last_shown > c.ultimoAnuncio)) c.ultimoAnuncio = i.last_shown;
    const host = hostDe(i.url);
    if (host) { const d = dominioRaiz(host); if (!c.sites.includes(d)) c.sites.push(d); }
    if (!c.nome && i.title) c.nome = i.title;
    m.set(id, c);
  }
  const contas = [...m.values()].map((c) => ({ ...c, pareceEmpresa: !!c.nome && EMPRESA.test(c.nome) }))
    .sort((a, b) => (b.ultimoAnuncio ?? "").localeCompare(a.ultimoAnuncio ?? ""));
  const outrosSites = [...new Set(contas.flatMap((c) => c.sites))].filter((d) => d !== dominioOriginal).sort();
  return { contas, outrosSites };
}
