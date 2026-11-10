import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { criptografar } from "@/lib/crypto";
import { concluirEmbeddedSignup, embeddedSignupFaltando } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Recebe o código do Embedded Signup, troca pelo token e salva a conexão (criptografada). */
export async function POST(req: Request) {
  const falta = embeddedSignupFaltando();
  if (falta.length) return NextResponse.json({ erro: `Faltam variáveis na Vercel: ${falta.join(", ")}` }, { status: 400 });
  const { codigo, wabaId, phoneId, evento } = await req.json().catch(() => ({}));
  if (!codigo) return NextResponse.json({ erro: "A Meta não devolveu o código. Tente de novo." }, { status: 400 });
  try {
    const c = await concluirEmbeddedSignup(String(codigo), wabaId ? String(wabaId) : null, phoneId ? String(phoneId) : null);
    await db().from("wa_conexao").update({ ativo: false }).eq("ativo", true);
    const { error } = await db().from("wa_conexao").insert({
      waba_id: c.wabaId, phone_number_id: c.phoneId, numero: c.numero, nome: c.nome,
      token_criptografado: criptografar(c.token), coexistencia: true, detalhes: { evento: evento ?? null },
    });
    if (error) return NextResponse.json({ erro: error.message + " — rodou o 0011_conexao_whatsapp.sql?" }, { status: 500 });
    return NextResponse.json({ ok: true, numero: c.numero, nome: c.nome });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
