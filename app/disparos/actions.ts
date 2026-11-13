"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { calcularPublico, criarCampanha, type Filtro } from "@/lib/disparos";
import { enviarTexto } from "@/lib/whatsapp";
import { paraE164 } from "@/lib/exportar";

/** Marca/desmarca a autorização do lead para receber WhatsApp. */
export async function marcarOptin(leadId: number, autorizou: boolean, origem: string) {
  const { data: lead } = await db().from("leads").select("telefone_principal").eq("id", leadId).single();
  const e164 = paraE164(lead?.telefone_principal ?? "");
  if (!e164) return { erro: "Este lead não tem celular válido." };
  const telefone = e164.slice(1);
  const agora = new Date().toISOString();
  const { error } = await db().from("wa_contatos").upsert(autorizou
    ? { telefone, lead_id: leadId, optin_em: agora, optin_origem: origem, optout_em: null }
    : { telefone, lead_id: leadId, optin_em: null, optin_origem: null }, { onConflict: "telefone" });
  if (error) return { erro: error.message + " — rodou o 0009_disparos.sql?" };
  await db().from("lead_events").insert({ lead_id: leadId, tipo: "whatsapp", texto: autorizou ? `Autorizou WhatsApp (${origem})` : "Autorização de WhatsApp removida" });
  revalidatePath(`/leads/${leadId}`); revalidatePath("/leads"); revalidatePath("/disparos");
  return { ok: true };
}

export async function previaPublico(filtro: Filtro) {
  const p = await calcularPublico(filtro);
  return { elegiveis: p.elegiveis.length, semCelular: p.semCelular, semAutorizacao: p.semAutorizacao, sairam: p.sairam, total: p.total,
    exemplo: p.elegiveis[0]?.lead ?? null };
}

export async function criarCampanhaAcao(d: { nome: string; modelo: string; idioma: string; variaveis: string[]; filtro: Filtro; ritmo: number }) {
  let id: number;
  try {
    id = await criarCampanha(d.nome.trim() || d.modelo, d.modelo, d.idioma, d.variaveis, d.filtro, Math.max(1, Math.min(60, d.ritmo)));
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
  redirect(`/disparos/${id}`);
}

export async function mudarStatusCampanha(id: number, status: "enviando" | "pausada" | "cancelada") {
  await db().from("wa_campanhas").update({ status, erro: null }).eq("id", id);
  if (status === "cancelada") await db().from("wa_envios").update({ status: "ignorado", erro: "Campanha cancelada" }).eq("campanha_id", id).eq("status", "pendente");
  revalidatePath(`/disparos/${id}`); revalidatePath("/disparos");
}

export async function responder(telefone: string, texto: string) {
  const { data: c } = await db().from("wa_contatos").select("ultima_entrada, lead_id, optout_em").eq("telefone", telefone).maybeSingle();
  if (!c?.ultima_entrada || Date.now() - new Date(c.ultima_entrada).getTime() > 24 * 3600_000) {
    return { erro: "Passaram 24h desde a última mensagem dele: a Meta só deixa mandar modelo aprovado agora." };
  }
  try {
    const wamid = await enviarTexto(telefone, texto);
    await db().from("wa_mensagens").insert({ telefone, lead_id: c.lead_id, direcao: "saida", tipo: "text", texto, wamid: wamid || null, status: "enviado" });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
  revalidatePath("/disparos/conversas");
  return { ok: true };
}

export async function salvarLimites(form: FormData) {
  const n = (k: string, min: number, max: number) => Math.max(min, Math.min(max, Number(form.get(k)) || min));
  await db().from("settings").upsert([
    { chave: "wa_limite_diario", valor: n("limite", 1, 100000) },
    { chave: "wa_ritmo_por_minuto", valor: n("ritmo", 1, 60) },
  ], { onConflict: "chave" });
  revalidatePath("/disparos");
}

export async function criarModeloAcao(m: import("@/lib/whatsapp").NovoModelo) {
  const { criarModelo } = await import("@/lib/whatsapp");
  try {
    const r = await criarModelo(m);
    revalidatePath("/disparos");
    return { ok: true, msg: `Modelo enviado para aprovação (status: ${r.status}). Acompanhe na tela Disparos.` };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  }
}

export async function enviarTesteAcao(telefone: string, modelo: string, idioma: string, parametros: string[]) {
  const { enviarModelo } = await import("@/lib/whatsapp");
  const d = telefone.replace(/\D/g, "");
  const para = d.startsWith("55") || d.length > 11 ? d : "55" + d;
  try {
    const wamid = await enviarModelo(para, modelo, idioma, parametros);
    await db().from("wa_mensagens").insert({ telefone: para, direcao: "saida", tipo: "template", texto: `[teste ${modelo}] ${parametros.join(" · ")}`, wamid, status: "enviado" });
    return { ok: true, msg: `Enviada para +${para}. Confira no WhatsApp (o status aparece em Conversas).` };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : String(e) };
  }
}

export async function ligarWebhooksAcao() {
  const { ligarWebhooksDaConta } = await import("@/lib/whatsapp");
  try { await ligarWebhooksDaConta(); revalidatePath("/disparos"); return { ok: true, msg: "Conta ligada ao app. Mande uma mensagem para o chip e veja em Conversas." }; }
  catch (e) { return { ok: false, msg: e instanceof Error ? e.message : String(e) }; }
}
