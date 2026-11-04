"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";

const STATUS = ["A contatar", "Contatado", "Respondeu", "Reunião marcada", "Proposta enviada", "Fechado", "Sem interesse", "Descartado"];

export async function atualizarLead(id: number, campo: "status" | "responsavel_id" | "data_contato" | "notas", valor: string) {
  let v: string | number | null = valor.trim() || null;
  if (campo === "status" && !STATUS.includes(String(v))) return { erro: "Status inválido" };
  if (campo === "responsavel_id") v = v ? Number(v) : null;
  const { data: antes } = await db().from("leads").select(campo).eq("id", id).single();
  const { error } = await db().from("leads").update({ [campo]: v }).eq("id", id);
  if (error) return { erro: error.message };
  const anterior = (antes as Record<string, unknown> | null)?.[campo];
  if (campo === "status" && anterior !== v) {
    await db().from("lead_events").insert({ lead_id: id, tipo: "status", texto: `${anterior ?? "—"} → ${v}` });
  }
  if (campo === "notas") await db().from("lead_events").insert({ lead_id: id, tipo: "nota", texto: String(v ?? "") });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}
