"use server";

import { redirect } from "next/navigation";
import { criarRodada } from "@/lib/motor";

export async function iniciarPesquisa(termos: string[], locationIds: number[]): Promise<{ erro: string }> {
  let id: number;
  try {
    id = await criarRodada(termos, locationIds);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
  redirect(`/rodadas/${id}`);
}

/** Termos e pontos de uma rodada anterior (para repetir). */
export async function dadosDaRodada(runId: number): Promise<{ termos: string[]; locationIds: number[] } | null> {
  const { db } = await import("@/lib/supabase");
  const { data: run } = await db().from("runs").select("termos").eq("id", runId).maybeSingle();
  if (!run) return null;
  const { data: buscas } = await db().from("run_searches").select("location_id").eq("run_id", runId).limit(5000);
  return { termos: run.termos as string[], locationIds: [...new Set((buscas ?? []).map((b) => b.location_id as number))] };
}

/** Repete uma rodada com as mesmas palavras e os mesmos pontos. */
export async function repetirRodada(form: FormData): Promise<void> {
  const runId = Number(form.get("rodada"));
  const d = await dadosDaRodada(runId);
  if (!d) redirect("/rodadas");
  let id: number;
  try {
    id = await criarRodada(d.termos, d.locationIds);
  } catch (e) {
    redirect(`/rodadas/${runId}?erro=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`);
  }
  redirect(`/rodadas/${id}`);
}

// ---------------------------------------------------------------------------
// Adicionar cidade/bairro que não está no catálogo (busca grátis no locations.json da SerpApi)
// ---------------------------------------------------------------------------
const ESTADO_SERPAPI: Record<string, string> = {
  AC: "State of Acre", AL: "State of Alagoas", AP: "State of Amapa", AM: "State of Amazonas", BA: "State of Bahia",
  CE: "State of Ceara", DF: "Federal District", ES: "State of Espirito Santo", GO: "State of Goias", MA: "State of Maranhao",
  MT: "State of Mato Grosso", MS: "State of Mato Grosso do Sul", MG: "State of Minas Gerais", PA: "State of Para",
  PB: "State of Paraiba", PR: "State of Parana", PE: "State of Pernambuco", PI: "State of Piaui", RJ: "State of Rio de Janeiro",
  RN: "State of Rio Grande do Norte", RS: "State of Rio Grande do Sul", RO: "State of Rondonia", RR: "State of Roraima",
  SC: "State of Santa Catarina", SP: "State of Sao Paulo", SE: "State of Sergipe", TO: "State of Tocantins",
};

export type CidadeEncontrada = { canonical: string; nome: string; tipo: string; jaExiste: boolean };

export async function buscarCidades(texto: string, uf: string): Promise<{ erro?: string; cidades: CidadeEncontrada[] }> {
  const t = texto.trim();
  if (t.length < 3) return { erro: "Digite pelo menos 3 letras.", cidades: [] };
  const { buscarLocais } = await import("@/lib/serpapi");
  const { db } = await import("@/lib/supabase");
  try {
    const semAcento = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const achados = await buscarLocais(semAcento, 30);
    const estado = ESTADO_SERPAPI[uf];
    const filtrados = achados
      .filter((a) => !estado || a.canonical_name.endsWith(`,${estado},Brazil`))
      .filter((a) => ["City", "Municipality", "District", "Neighborhood"].includes(a.target_type));
    const { data: existentes } = await db().from("locations").select("serpapi_canonical")
      .in("serpapi_canonical", filtrados.map((f) => f.canonical_name).slice(0, 50));
    const ja = new Set((existentes ?? []).map((e) => e.serpapi_canonical));
    return {
      cidades: filtrados.slice(0, 10).map((a) => ({
        canonical: a.canonical_name, nome: a.name, tipo: a.target_type, jaExiste: ja.has(a.canonical_name),
      })),
      ...(filtrados.length ? {} : { erro: `A SerpApi não tem "${t}" ${estado ? "nesse estado" : ""}. Tente o nome sem abreviação ou a cidade vizinha.` }),
    };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e), cidades: [] };
  }
}

export async function adicionarCidade(canonical: string, nome: string, tipo: string, regionId: number) {
  const { db } = await import("@/lib/supabase");
  const { data: reg } = await db().from("regions").select("id, ddd").eq("id", regionId).maybeSingle();
  if (!reg) return { erro: "Escolha a região onde a cidade vai ficar." };
  const { data: existente } = await db().from("locations").select("id, region_id, nome_exibicao, camada")
    .eq("region_id", regionId).eq("serpapi_canonical", canonical).maybeSingle();
  if (existente) {
    await db().from("locations").update({ ativo: true }).eq("id", existente.id);
    return { local: existente };
  }
  const { data, error } = await db().from("locations").insert({
    region_id: regionId, nome_exibicao: nome, serpapi_canonical: canonical,
    tipo: ["City", "District", "Neighborhood", "Municipality"].includes(tipo) ? tipo : "City",
    camada: "ampla", ddd_esperado: reg.ddd, ativo: true, validado_em: new Date().toISOString(),
  }).select("id, region_id, nome_exibicao, camada").single();
  if (error) return { erro: error.message };
  return { local: data };
}
