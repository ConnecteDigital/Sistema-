import Link from "next/link";
import { db } from "@/lib/supabase";
import { alternarAgendamento, excluirAgendamento } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agendamentos" };
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function Agendamentos() {
  const { data, error } = await db().from("schedules")
    .select("id, nome, horarios, dias, ativo, rodada_origem, ultimos, ultimo_erro, location_ids, termos").order("id");
  const cronOk = !!process.env.CRON_SECRET?.trim();
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Agendamentos</h1>
      {error && <p className="text-sm text-red-600">{error.message} — rodou o 0010_agendamentos.sql?</p>}
      {!cronOk && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Falta a variável <code>CRON_SECRET</code> na Vercel e o relógio no Supabase (arquivo <code>supabase/relogio_supabase.sql</code>). Sem isso os agendamentos não disparam.
        </p>
      )}
      {!(data ?? []).length ? (
        <p className="cartao p-4 text-sm text-suave">Nenhum agendamento. Abra uma rodada e clique em “⏰ Agendar repetição”.</p>
      ) : (data ?? []).map((a) => {
        const custo = (a.termos as string[]).length * (a.location_ids as number[]).length;
        const recentes = Object.entries((a.ultimos ?? {}) as Record<string, number>).slice(-5).reverse();
        return (
          <div key={a.id} className={`cartao space-y-2 p-4 text-sm ${a.ativo ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{a.nome}</p>
              <div className="flex gap-2">
                <form action={alternarAgendamento}>
                  <input type="hidden" name="id" value={a.id} /><input type="hidden" name="ativo" value={String(a.ativo)} />
                  <button className={a.ativo ? "botao" : "botao-sec"}>{a.ativo ? "● Ligado" : "○ Desligado"}</button>
                </form>
                <form action={excluirAgendamento}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="botao-sec text-red-600">Excluir</button>
                </form>
              </div>
            </div>
            <p>
              <strong>{(a.horarios as string[]).join(" · ")}</strong> · {(a.dias as number[]).map((d) => DIAS[d]).join(", ")}
              <span className="text-suave"> · {custo} créditos por execução</span>
            </p>
            {a.rodada_origem && <p className="text-xs"><Link href={`/rodadas/${a.rodada_origem}`} className="text-marca hover:underline">editar horários na rodada #{a.rodada_origem}</Link></p>}
            {recentes.length > 0 && (
              <p className="text-xs text-suave">Últimas: {recentes.map(([k, id]) => id ? <Link key={k} href={`/rodadas/${id}`} className="mr-2 text-marca hover:underline">{k}</Link> : <span key={k} className="mr-2">{k} (não rodou)</span>)}</p>
            )}
            {a.ultimo_erro && <p className="text-xs text-red-600">Último problema: {a.ultimo_erro}</p>}
          </div>
        );
      })}
    </main>
  );
}
