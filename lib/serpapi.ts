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
