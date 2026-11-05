// "Anunciando na palavra-chave errada": o site fala do termo que ele anunciou? Pura.

const IGNORAR = new Set([
  "24", "horas", "hora", "perto", "de", "da", "do", "das", "dos", "mim", "mais", "proximo", "proxima", "emergencia",
  "residencial", "comercial", "em", "na", "no", "e", "o", "a", "barato", "barata", "preco", "orcamento", "zona",
  "sul", "norte", "leste", "oeste", "centro", "regiao", "servico", "servicos", "empresa", "melhor", "rapido", "rapida",
  "urgente", "agora", "hoje", "domicilio", "sp", "rj", "bh",
]);

export const normalizar = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Radicais da palavra principal: "encanador 24 horas" → ["encanad"]; "caça vazamento" → ["caca", "vazamen"]. */
export function radicais(termo: string): string[] {
  return normalizar(termo).split(" ")
    .filter((p) => p.length >= 4 && !IGNORAR.has(p) && !/^\d+$/.test(p))
    .map((p) => p.slice(0, Math.min(p.length, 7)));
}

/** true = o site menciona o termo; false = não menciona; null = não dá para afirmar (sem texto suficiente). */
export function siteFalaDoTermo(textoNormalizado: string | null, termo: string): boolean | null {
  if (!textoNormalizado || textoNormalizado.length < 400) return null;
  const rs = radicais(termo);
  if (!rs.length) return null;
  return rs.some((r) => new RegExp(`\\b${r}`).test(textoNormalizado));
}

/** Avalia todos os termos em que o anunciante apareceu. ausentes = termos que o site não menciona. */
export function avaliarTermos(textoNormalizado: string | null, termos: string[]) {
  const resultados = termos.map((t) => ({ termo: t, fala: siteFalaDoTermo(textoNormalizado, t) }));
  if (resultados.every((r) => r.fala === null)) return { termoNoSite: null as boolean | null, ausentes: [] as string[] };
  const ausentes = resultados.filter((r) => r.fala === false).map((r) => r.termo);
  // "errada" só quando NENHUM dos termos aparece no site
  return { termoNoSite: resultados.some((r) => r.fala === true), ausentes };
}
