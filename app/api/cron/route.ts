import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { criarRodada, processarLote } from "@/lib/motor";
import { processarCampanha } from "@/lib/disparos";
import { agoraBrasilia, horariosDevidos, type Agendamento } from "@/lib/agenda";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chamado a cada ~5 min (pg_cron do Supabase ou Vercel Cron), com "Authorization: Bearer CRON_SECRET".
 * 1) dispara agendamentos devidos; 2) faz andar rodadas em andamento; 3) faz andar campanhas de WhatsApp.
 */
async function rodar(req: Request) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const tempo = () => Date.now() - inicio;
  const log: string[] = [];
  const agora = agoraBrasilia();

  // 1) Agendamentos
  const { data: ags } = await db().from("schedules").select("*").eq("ativo", true);
  for (const a of (ags ?? []) as (Agendamento & { termos: string[]; location_ids: number[]; nome: string })[]) {
    for (const h of horariosDevidos(a, agora)) {
      const chave = `${agora.data} ${h}`;
      // marca ANTES de criar, para nunca disparar duas vezes o mesmo horário
      const ultimos = Object.fromEntries(Object.entries({ ...(a.ultimos ?? {}), [chave]: 0 }).slice(-60));
      await db().from("schedules").update({ ultimos }).eq("id", a.id);
      try {
        const id = await criarRodada(a.termos, a.location_ids);
        await db().from("runs").update({ origem: "agendada", schedule_id: a.id }).eq("id", id);
        await db().from("schedules").update({ ultimos: { ...ultimos, [chave]: id }, ultimo_erro: null }).eq("id", a.id);
        log.push(`agendamento ${a.id} ${h} → rodada ${id}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await db().from("schedules").update({ ultimo_erro: `${chave}: ${msg}` }).eq("id", a.id);
        log.push(`agendamento ${a.id} ${h} erro: ${msg}`);
      }
    }
  }

  // 2) Rodadas em andamento (das últimas 24h), enquanto houver tempo
  const desde = new Date(Date.now() - 86_400_000).toISOString();
  const { data: runs } = await db().from("runs").select("id, erro").in("status", ["pendente", "buscando", "verificando"])
    .gte("criado_em", desde).is("erro", null).order("id");
  for (const r of runs ?? []) {
    while (tempo() < 40_000) {
      try {
        const p = await processarLote(r.id);
        if (p.terminou || p.erro) break;
      } catch (e) { log.push(`rodada ${r.id}: ${e instanceof Error ? e.message : e}`); break; }
    }
    if (tempo() >= 40_000) break;
  }

  // 3) Campanhas de WhatsApp enviando (um lote por chamada)
  if (tempo() < 45_000) {
    const { data: camps } = await db().from("wa_campanhas").select("id").eq("status", "enviando");
    for (const c of camps ?? []) {
      if (tempo() >= 50_000) break;
      try { await processarCampanha(c.id); } catch (e) { log.push(`campanha ${c.id}: ${e instanceof Error ? e.message : e}`); }
    }
  }

  return NextResponse.json({ ok: true, agora, ms: tempo(), log });
}

export const GET = rodar;
export const POST = rodar;
