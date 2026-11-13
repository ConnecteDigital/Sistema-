import "server-only";

const BASE = "https://serpapi.com";

export type ContaSerpApi = {
  plano: string | null;
  buscasPorMes: number | null;
  usoMes: number | null;
  creditosRestantes: number | null;
  limitePorHora: number | null;
  buscasNestaHora: number | null;
};

/** Consulta créditos da chave. Grátis: não gasta busca. */
export async function consultarConta(apiKey: string): Promise<ContaSerpApi> {
  const r = await fetch(`${BASE}/account.json?api_key=${encodeURIComponent(apiKey)}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `SerpApi respondeu HTTP ${r.status}`);
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    plano: j.plan_name ?? null,
    buscasPorMes: n(j.searches_per_month),
    usoMes: n(j.this_month_usage),
    // total_searches_left inclui créditos extras; plan_searches_left é só o do plano
    creditosRestantes: n(j.total_searches_left) ?? n(j.plan_searches_left),
    limitePorHora: n(j.account_rate_limit_per_hour),
    buscasNestaHora: n(j.this_hour_searches),
  };
}

export type LocalSerpApi = { canonical_name: string; target_type: string; country_code: string; name: string };

/** Busca no catálogo de locais da SerpApi. Grátis: não gasta busca. */
export async function buscarLocais(texto: string, limite = 10): Promise<LocalSerpApi[]> {
  const r = await fetch(`${BASE}/locations.json?q=${encodeURIComponent(texto)}&limit=${limite}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`SerpApi locations HTTP ${r.status}`);
  const j = (await r.json()) as LocalSerpApi[];
  return j.filter((l) => l.country_code === "BR");
}

export type AnuncioSerpApi = {
  position?: number; block_position?: string; title?: string; link?: string; displayed_link?: string;
  source?: string; sitelinks?: unknown; extensions?: unknown; rating?: number; reviews?: number;
  tracking_link?: string;
};

export type OrganicoSerpApi = {
  position?: number; title?: string; link?: string; displayed_link?: string; source?: string;
};

export type ResultadoBusca =
  // organicos = null quando a resposta não trouxe o bloco orgânico (não dá para afirmar que o site não aparece)
  | { tipo: "ok"; anuncios: AnuncioSerpApi[]; organicos: OrganicoSerpApi[] | null; localUsado: string | null }
  | { tipo: "sem_creditos"; msg: string }
  | { tipo: "erro"; msg: string };

/**
 * Uma busca ao vivo (engine google_ads, celular). Gasta 1 crédito (exceto cache de 1h).
 * A mesma resposta traz os anúncios (patrocinado) e os resultados orgânicos da 1ª página.
 */
export async function buscarAnuncios(apiKey: string, termo: string, location: string): Promise<ResultadoBusca> {
  const p = new URLSearchParams({
    engine: "google_ads", q: termo, location, google_domain: "google.com.br",
    gl: "br", hl: "pt-br", device: "mobile", api_key: apiKey,
  });
  let r: Response;
  try {
    r = await fetch(`${BASE}/search.json?${p}`, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
  } catch (e) {
    return { tipo: "erro", msg: "Falha de rede: " + (e instanceof Error ? e.message : String(e)) };
  }
  const j = await r.json().catch(() => ({} as Record<string, unknown>));
  const erro = typeof j.error === "string" ? j.error : null;
  const localUsado = (j.search_parameters as { location_used?: string } | undefined)?.location_used ?? null;

  if (erro) {
    // Sem anúncios/resultados não é erro: é uma busca válida com 0 anúncios
    if (/hasn't returned any results|no results/i.test(erro)) return { tipo: "ok", anuncios: [], organicos: null, localUsado };
    if (r.status === 429 || /run out of searches|searches? (left|remaining)|plan.*limit|exceeded|rate limit/i.test(erro)) {
      return { tipo: "sem_creditos", msg: erro };
    }
    if (r.status === 401 || /invalid api key/i.test(erro)) return { tipo: "sem_creditos", msg: erro };
    return { tipo: "erro", msg: erro };
  }
  if (!r.ok) return { tipo: "erro", msg: `SerpApi HTTP ${r.status}` };
  return {
    tipo: "ok",
    anuncios: Array.isArray(j.ads) ? (j.ads as AnuncioSerpApi[]) : [],
    organicos: Array.isArray(j.organic_results) ? (j.organic_results as OrganicoSerpApi[]) : null,
    localUsado,
  };
}
