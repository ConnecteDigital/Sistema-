import "server-only";
import { db } from "./supabase";
import { PLATAFORMAS, identificarAnunciante } from "./dominio";
import { reagregar } from "./motor";

/**
 * Corrige anunciantes que foram agrupados pelo domínio da plataforma (ex.: todos os sites "*.lovable.app"
 * viraram um só "lovable.app"): recalcula o domínio de cada anúncio, refaz as rodadas afetadas e
 * apaga o anunciante misturado.
 */
export async function corrigirPlataformas(): Promise<{ sites: string[]; rodadas: number[]; anuncios: number }> {
  const { data: advs, error } = await db().from("advertisers").select("id, dominio").in("dominio", PLATAFORMAS);
  if (error) throw new Error(error.message);
  if (!advs?.length) return { sites: [], rodadas: [], anuncios: 0 };
  const advIds = advs.map((a) => a.id);

  // 1) recalcula o domínio de cada anúncio bruto
  type Ad = { id: number; link: string | null; displayed_link: string | null; source: string | null; dominio: string };
  const ads: Ad[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await db().from("ads_raw").select("id, link, displayed_link, source, dominio")
      .in("dominio", advs.map((a) => a.dominio)).order("id").range(de, de + 999);
    ads.push(...((data ?? []) as Ad[]));
    if (!data || data.length < 1000) break;
  }
  const porNovo = new Map<string, number[]>();
  for (const a of ads) {
    const novo = identificarAnunciante(a)?.dominio;
    if (novo && novo !== a.dominio) {
      if (!porNovo.has(novo)) porNovo.set(novo, []);
      porNovo.get(novo)!.push(a.id);
    }
  }
  for (const [dominio, ids] of porNovo) {
    for (let i = 0; i < ids.length; i += 200) await db().from("ads_raw").update({ dominio }).in("id", ids.slice(i, i + 200));
  }

  // 2) rodadas afetadas: refaz a agregação (sites, CNPJ e leads seguem ao abrir a rodada)
  const { data: ra } = await db().from("run_advertisers").select("run_id").in("advertiser_id", advIds).limit(10000);
  const rodadas = [...new Set((ra ?? []).map((r) => r.run_id as number))].sort((a, b) => a - b);
  for (const r of rodadas) await reagregar(r);

  // 3) apaga o anunciante misturado (e o lead/consultas dele, que misturavam empresas)
  await db().from("advertisers").delete().in("id", advIds);

  return { sites: [...porNovo.keys()].sort(), rodadas, anuncios: ads.length };
}
