import { NextResponse } from "next/server";
import { processarLote } from "@/lib/motor";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Processa um lote de buscas da rodada e devolve o progresso. Pode ser chamado várias vezes. */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ erro: "id inválido" }, { status: 400 });
  try {
    return NextResponse.json(await processarLote(id));
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
