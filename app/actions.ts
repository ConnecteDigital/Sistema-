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
