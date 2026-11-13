import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { assinaturaValida, normalizarWaBr, pedeParaSair } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Verificação do webhook (a Meta chama ao cadastrar a URL). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" &&
      u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN?.trim()) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

const ORDEM = ["pendente", "enviando", "enviado", "entregue", "lido", "respondido"];
const MAPA: Record<string, string> = { sent: "enviado", delivered: "entregue", read: "lido", failed: "falhou" };

type Valor = {
  statuses?: { id: string; status: string; recipient_id?: string; errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] }[];
  messages?: { from: string; id: string; type: string; text?: { body?: string }; button?: { text?: string; payload?: string };
    interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }[];
};

/** Eventos: status das mensagens enviadas e mensagens recebidas. Sempre responde 200 rápido. */
export async function POST(req: Request) {
  const corpo = await req.text();
  if (!assinaturaValida(corpo, req.headers.get("x-hub-signature-256"))) {
    console.warn("[webhook] assinatura inválida — confira META_APP_SECRET / WHATSAPP_APP_SECRET na Vercel");
    return new Response("assinatura inválida", { status: 401 });
  }
  let j: { entry?: { changes?: { value?: Valor }[] }[] };
  try { j = JSON.parse(corpo); } catch { return NextResponse.json({ ok: true }); }

  for (const entry of j.entry ?? []) for (const ch of entry.changes ?? []) {
    const v = ch.value ?? {};

    for (const s of v.statuses ?? []) {
      const novo = MAPA[s.status];
      if (!novo) continue;
      const { data: env } = await db().from("wa_envios").select("id, status").eq("wamid", s.id).maybeSingle();
      const erro = s.errors?.[0] ? `${s.errors[0].code ?? ""} ${s.errors[0].error_data?.details ?? s.errors[0].message ?? s.errors[0].title ?? ""}`.trim() : null;
      if (env && (novo === "falhou" || ORDEM.indexOf(novo) > ORDEM.indexOf(env.status))) {
        await db().from("wa_envios").update({ status: novo, erro, atualizado_em: new Date().toISOString() }).eq("id", env.id);
      }
      await db().from("wa_mensagens").update({ status: novo }).eq("wamid", s.id);
    }

    for (const bruto of v.messages ?? []) {
      // o WhatsApp manda muitos celulares do Brasil sem o 9: volta para o formato do sistema
      const m = { ...bruto, from: normalizarWaBr(bruto.from) };
      const texto = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? `[${m.type}]`;
      const agora = new Date().toISOString();
      const { data: contato } = await db().from("wa_contatos").select("lead_id").eq("telefone", m.from).maybeSingle();
      let leadId = contato?.lead_id ?? null;
      if (!leadId) {
        const { data: env } = await db().from("wa_envios").select("lead_id").eq("telefone", m.from).order("id", { ascending: false }).limit(1).maybeSingle();
        leadId = env?.lead_id ?? null;
      }
      // grava a mensagem (sem duplicar se a Meta reenviar o mesmo aviso)
      const { data: jaTem } = await db().from("wa_mensagens").select("id").eq("wamid", m.id).maybeSingle();
      if (!jaTem) {
        const { error: eMsg } = await db().from("wa_mensagens").insert(
          { telefone: m.from, lead_id: leadId, direcao: "entrada", tipo: m.type, texto, wamid: m.id, bruto: m as unknown as object });
        if (eMsg) console.error("[webhook] erro ao gravar mensagem:", eMsg.message);
      }

      const sair = pedeParaSair(texto) || /nao tenho interesse|sair da lista/i.test((m.button?.payload ?? "").normalize("NFD").replace(/[̀-ͯ]/g, ""));
      const { error: eCont } = await db().from("wa_contatos").upsert({
        telefone: m.from, lead_id: leadId, ultima_entrada: agora, ...(sair ? { optout_em: agora } : {}),
      }, { onConflict: "telefone" });
      if (eCont) console.error("[webhook] erro ao gravar contato:", eCont.message);

      // marca o último envio como respondido e o lead como "Respondeu"
      const { data: ultimo } = await db().from("wa_envios").select("id").eq("telefone", m.from).not("wamid", "is", null)
        .order("id", { ascending: false }).limit(1).maybeSingle();
      if (ultimo) await db().from("wa_envios").update({ status: "respondido", atualizado_em: agora }).eq("id", ultimo.id);
      if (leadId) {
        const { data: lead } = await db().from("leads").select("status").eq("id", leadId).maybeSingle();
        const novoStatus = sair ? "Sem interesse" : lead?.status === "A contatar" || lead?.status === "Contatado" ? "Respondeu" : null;
        if (novoStatus && lead?.status !== novoStatus) {
          await db().from("leads").update({ status: novoStatus }).eq("id", leadId);
          await db().from("lead_events").insert({ lead_id: leadId, tipo: "status", texto: `${lead?.status ?? "—"} → ${novoStatus} (WhatsApp)` });
        }
        await db().from("lead_events").insert({ lead_id: leadId, tipo: "whatsapp", texto });
      }
    }
  }
  console.log(`[webhook] ok: ${(j.entry ?? []).flatMap((e) => e.changes ?? []).map((c) => `${(c.value?.messages ?? []).length} msg, ${(c.value?.statuses ?? []).length} status`).join(" | ")}`);
  return NextResponse.json({ ok: true });
}
