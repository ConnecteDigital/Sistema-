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

/**
 * Ramos parecidos: quem anuncia "encanador" e no site fala de "caça vazamento" ou "hidráulica" está no ramo certo.
 * Cada família lista inícios de palavra (já sem acento). Se o termo cai numa família, vale qualquer palavra dela.
 */
export const FAMILIAS: string[][] = [
  // encanamento / hidráulica / vazamento
  ["encanad", "encanam", "hidraul", "vazamen", "tubulac", "caca vaz", "bombeiro hidr", "infiltrac", "geofon"],
  // desentupimento / esgoto / fossa
  ["desentu", "entupi", "esgoto", "fossa", "hidrojat", "caixa de gordura", "sumidour", "sugador", "limpa fossa"],
  // elétrica
  ["eletric", "eletrot", "instalacao eletr", "quadro de distrib", "padrao de energ"],
  // serralheria
  ["serralh", "portao", "portoes", "grade", "esquadri", "estrutura metal"],
];

function familiaDe(radical: string): string[] | null {
  for (const f of FAMILIAS) {
    if (f.some((x) => !x.includes(" ") && (radical.startsWith(x) || x.startsWith(radical)))) return f;
  }
  return null;
}

/** true = o site menciona o termo (ou um serviço do mesmo ramo); false = não menciona; null = não dá para afirmar. */
export function siteFalaDoTermo(textoNormalizado: string | null, termo: string): boolean | null {
  if (!textoNormalizado || textoNormalizado.length < 400) return null;
  const rs = radicais(termo);
  if (!rs.length) return null;
  const tem = (x: string) => new RegExp(`\\b${x.replace(/ /g, "\\s+")}`).test(textoNormalizado);
  return rs.some((r) => tem(r) || (familiaDe(r) ?? []).some(tem));
}

/** Avalia todos os termos em que o anunciante apareceu. ausentes = termos que o site não menciona. */
export function avaliarTermos(textoNormalizado: string | null, termos: string[]) {
  const resultados = termos.map((t) => ({ termo: t, fala: siteFalaDoTermo(textoNormalizado, t) }));
  if (resultados.every((r) => r.fala === null)) return { termoNoSite: null as boolean | null, ausentes: [] as string[] };
  const ausentes = resultados.filter((r) => r.fala === false).map((r) => r.termo);
  // "errada" só quando NENHUM dos termos aparece no site
  return { termoNoSite: resultados.some((r) => r.fala === true), ausentes };
}
