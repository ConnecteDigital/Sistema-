import { NextResponse } from "next/server";
import { retomar } from "@/lib/motor";

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await retomar(Number((await ctx.params).id));
  return NextResponse.json({ ok: true });
}
