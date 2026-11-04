import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { consultarCnpjDoSite } from "@/lib/consulta-cnpj";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Consulta o CNPJ do anunciante (só quando o usuário clica). Grátis. Guarda o resultado. */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const { data: adv } = await db().from("advertisers").select("id, dominio").eq("id", id).maybeSingle();
  if (!adv) return NextResponse.json({ erro: "Anunciante não encontrado" }, { status: 404 });
  if (adv.dominio.startsWith("perfil-google:")) {
    return NextResponse.json({ erro: "Esse anúncio leva para o perfil do Google, não tem site para consultar." }, { status: 400 });
  }
  const { data: ultimo } = await db().from("run_advertisers").select("link")
    .eq("advertiser_id", id).order("id", { ascending: false }).limit(1).maybeSingle();
  try {
    const resultado = await consultarCnpjDoSite(adv.dominio, ultimo?.link ?? null);
    const consultado_em = new Date().toISOString();
    await db().from("consultas_cnpj").upsert({ advertiser_id: id, resultado, consultado_em }, { onConflict: "advertiser_id" });
    return NextResponse.json({ resultado, consultado_em });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
