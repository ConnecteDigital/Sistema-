import { NextResponse } from "next/server";
import { processarCampanha } from "@/lib/disparos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(await processarCampanha(Number((await ctx.params).id)));
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
