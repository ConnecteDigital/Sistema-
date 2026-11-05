import Link from "next/link";
import { db } from "@/lib/supabase";
import { formatarData } from "@/lib/utils";
import { Responder } from "./responder";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversas" };

export default async function Conversas({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const { tel } = await searchParams;
  const { data: recentes } = await db().from("wa_mensagens").select("telefone, direcao, texto, criado_em, lead_id")
    .order("criado_em", { ascending: false }).limit(1000);
  // uma linha por telefone, conversas com resposta primeiro
  const porTel = new Map<string, { ultima: string; texto: string | null; temEntrada: boolean; lead_id: number | null }>();
  for (const m of recentes ?? []) {
    const c = porTel.get(m.telefone) ?? { ultima: m.criado_em, texto: m.texto, temEntrada: false, lead_id: m.lead_id };
    if (m.direcao === "entrada") c.temEntrada = true;
    porTel.set(m.telefone, c);
  }
  const lista = [...porTel].filter(([, c]) => c.temEntrada);
  const atual = tel ?? lista[0]?.[0];
  const [{ data: msgs }, { data: contato }] = atual ? await Promise.all([
    db().from("wa_mensagens").select("direcao, texto, criado_em, status").eq("telefone", atual).order("criado_em").limit(500),
    db().from("wa_contatos").select("ultima_entrada, optout_em, lead_id").eq("telefone", atual).maybeSingle(),
  ]) : [{ data: [] }, { data: null }];
  const janelaAberta = !!contato?.ultima_entrada && Date.now() - new Date(contato.ultima_entrada).getTime() < 24 * 3600_000;

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Conversas</h1>
        <Link href="/disparos" className="text-sm text-marca hover:underline">← Disparos</Link>
      </div>
      {!lista.length ? <p className="cartao p-4 text-sm text-suave">Ninguém respondeu ainda.</p> : (
        <div className="grid gap-3 md:grid-cols-[280px_1fr]">
          <div className="cartao max-h-[70vh] overflow-y-auto">
            {lista.map(([t, c]) => (
              <Link key={t} href={`/disparos/conversas?tel=${t}`}
                className={`block border-b border-borda px-3 py-2 text-sm last:border-0 hover:bg-slate-50 ${t === atual ? "bg-blue-50" : ""}`}>
                <p className="font-mono text-xs">+{t}</p>
                <p className="truncate text-xs text-suave">{c.texto}</p>
                <p className="text-[11px] text-suave">{formatarData(c.ultima)}</p>
              </Link>
            ))}
          </div>
          <div className="cartao flex max-h-[70vh] flex-col">
            <div className="border-b border-borda px-4 py-2 text-sm">
              <span className="font-mono">+{atual}</span>
              {contato?.lead_id && <Link href={`/leads/${contato.lead_id}`} className="ml-2 text-marca hover:underline">abrir lead</Link>}
              {contato?.optout_em && <span className="selo ml-2 bg-slate-200 text-slate-600">pediu para sair</span>}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {(msgs ?? []).map((m, i) => (
                <div key={i} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.direcao === "entrada" ? "bg-slate-100" : "ml-auto bg-green-100"}`}>
                  <p className="whitespace-pre-wrap">{m.texto}</p>
                  <p className="mt-0.5 text-right text-[10px] text-suave">{formatarData(m.criado_em)}{m.status ? ` · ${m.status}` : ""}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-borda p-3">
              {janelaAberta && !contato?.optout_em
                ? <Responder telefone={atual!} />
                : <p className="text-xs text-suave">Fora da janela de 24h (ou pediu para sair): a Meta só permite mandar modelo aprovado.</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
