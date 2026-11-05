import "server-only";

// DataForSEO — Central de Transparência do Google Ads (seção 11). Opcional: precisa de DATAFORSEO_LOGIN/PASSWORD.
// Tarefas assíncronas: task_post devolve um id; task_get/advanced/<id> devolve o resultado quando ficar pronto.

const BASE = "https://api.dataforseo.com/v3/serp/google/ads_search";

export function dataForSeoConfigurado() {
  return !!(process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());
}

function auth() {
  const t = Buffer.from(`${process.env.DATAFORSEO_LOGIN!.trim()}:${process.env.DATAFORSEO_PASSWORD!.trim()}`).toString("base64");
  return { authorization: `Basic ${t}`, "content-type": "application/json" };
}

type Tarefa = { id?: string; status_code?: number; status_message?: string; result?: { items?: ItemAds[] | null }[] | null };
type Resposta = { status_code?: number; status_message?: string; tasks?: Tarefa[] };

export type ItemAds = {
  type?: string; advertiser_id?: string; creative_id?: string; title?: string; url?: string; verified?: boolean;
  format?: string; first_shown?: string; last_shown?: string;
};

async function postar(corpo: Record<string, unknown>): Promise<string> {
  const r = await fetch(`${BASE}/task_post`, {
    method: "POST", headers: auth(), body: JSON.stringify([corpo]), cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as Resposta;
  const t = j.tasks?.[0];
  if (!r.ok || !t?.id || (t.status_code && t.status_code >= 40000)) {
    throw new Error(`DataForSEO: ${t?.status_message ?? j.status_message ?? `HTTP ${r.status}`}`);
  }
  return t.id;
}

/** Tarefa 1: anúncios de um domínio (descobre a conta do Google Ads). */
export const postarDominio = (dominio: string) =>
  postar({ target: dominio, location_name: "Brazil", platform: "all", depth: 100 });

/** Tarefa 2: tudo que as contas anunciam (descobre outros sites do mesmo dono). Até 25 contas. */
export const postarContas = (ids: string[]) =>
  postar({ advertiser_ids: ids.slice(0, 25), location_name: "Brazil", platform: "all", depth: 200 });

/** null = ainda processando; array = pronto (pode vir vazio). */
export async function buscarTarefa(id: string): Promise<{ itens: ItemAds[] | null; bruto: unknown }> {
  const r = await fetch(`${BASE}/task_get/advanced/${id}`, { headers: auth(), cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const j = (await r.json().catch(() => ({}))) as Resposta;
  const t = j.tasks?.[0];
  const cod = t?.status_code ?? 0;
  if (cod === 20000) return { itens: (t?.result?.[0]?.items ?? []).filter((i) => i.advertiser_id), bruto: j };
  if (cod === 40601 || cod === 40602 || cod === 20100) return { itens: null, bruto: j };   // na fila / em processamento
  if (cod === 40102) return { itens: [], bruto: j };                                       // sem resultados
  throw new Error(`DataForSEO: ${t?.status_message ?? j.status_message ?? `HTTP ${r.status}`}`);
}
