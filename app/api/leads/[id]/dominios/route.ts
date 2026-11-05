import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { consultarCnpjDoSite } from "@/lib/consulta-cnpj";
import { dominioRaiz, hostDe } from "@/lib/dominio";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Consulta o dono (Registro.br + site + Receita) de outro domínio que você sabe ser do mesmo dono. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const leadId = Number((await ctx.params).id);
  const { dominio: bruto } = await req.json().catch(() => ({ dominio: "" }));
  const host = hostDe(String(bruto ?? ""));
  if (!host) return NextResponse.json({ erro: "Domínio inválido. Ex.: hidroexpress.com.br" }, { status: 400 });
  const dominio = dominioRaiz(host);
  try {
    const resultado = await consultarCnpjDoSite(dominio, null);
    const { error } = await db().from("lead_dominios").upsert(
      { lead_id: leadId, dominio, resultado, consultado_em: new Date().toISOString() }, { onConflict: "lead_id,dominio" });
    if (error) return NextResponse.json({ erro: error.message + " — rodou o 0007_outros_dominios.sql?" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
