import { NextResponse } from "next/server";
import { reprocessar } from "@/lib/motor";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await reprocessar(Number((await ctx.params).id));
  return NextResponse.json({ ok: true });
}
