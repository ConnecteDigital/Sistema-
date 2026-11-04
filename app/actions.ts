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
