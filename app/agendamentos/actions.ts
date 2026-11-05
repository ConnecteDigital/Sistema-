"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { normalizarHorario } from "@/lib/agenda";
import { dadosDaRodada } from "@/app/actions";

/** Cria ou atualiza o agendamento de repetição de uma rodada. */
export async function salvarAgendamento(rodada: number, horariosBrutos: string[], dias: number[], ativo: boolean) {
  const horarios = [...new Set(horariosBrutos.map(normalizarHorario).filter((h): h is string => !!h))].sort();
  if (!horarios.length) return { erro: "Coloque pelo menos um horário (ex.: 13:00)." };
  if (!dias.length) return { erro: "Marque pelo menos um dia da semana." };
  const d = await dadosDaRodada(rodada);
  if (!d) return { erro: "Rodada não encontrada." };
  const { data: existente } = await db().from("schedules").select("id").eq("rodada_origem", rodada).maybeSingle();
  const campos = {
    nome: `Repetir rodada #${rodada}: ${d.termos.slice(0, 3).join(", ")}${d.termos.length > 3 ? "…" : ""}`,
    termos: d.termos, location_ids: d.locationIds, horarios, dias: [...new Set(dias)].sort(), ativo, rodada_origem: rodada,
  };
  const { error } = existente
    ? await db().from("schedules").update(campos).eq("id", existente.id)
    : await db().from("schedules").insert({ ...campos, cron: null });
  if (error) return { erro: error.message + " — rodou o 0010_agendamentos.sql?" };
  revalidatePath(`/rodadas/${rodada}`); revalidatePath("/agendamentos");
  return { ok: true };
}

export async function alternarAgendamento(form: FormData) {
  await db().from("schedules").update({ ativo: form.get("ativo") !== "true" }).eq("id", Number(form.get("id")));
  revalidatePath("/agendamentos");
}

export async function excluirAgendamento(form: FormData) {
  await db().from("schedules").delete().eq("id", Number(form.get("id")));
  revalidatePath("/agendamentos");
}
