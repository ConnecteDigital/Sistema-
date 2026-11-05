import Link from "next/link";
import { db } from "@/lib/supabase";
import { formatarData } from "@/lib/utils";
import { BotoesRepetir } from "@/components/botoes-repetir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rodadas" };

const STATUS: Record<string, string> = {
  pendente: "Pendente", buscando: "Buscando", verificando: "Verificando sites", pronta: "Pronta", erro: "Erro",
};

export default async function Rodadas() {
  const { data, error } = await db().from("runs")
    .select("id, criado_em, termos, status, total_buscas, buscas_ok, erro").order("id", { ascending: false }).limit(100);
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Rodadas</h1>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {!data?.length ? (
        <p className="text-sm text-suave">Nenhuma rodada ainda. <Link href="/" className="text-marca hover:underline">Fazer uma pesquisa</Link></p>
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-suave">
              <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Termos</th>
                <th className="px-3 py-2 text-right">Buscas</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t border-borda hover:bg-slate-50">
                  <td className="px-3 py-2"><Link href={`/rodadas/${r.id}`} className="text-marca hover:underline">{r.id}</Link></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatarData(r.criado_em)}</td>
                  <td className="px-3 py-2"><Link href={`/rodadas/${r.id}`} className="hover:underline">{(r.termos as string[]).join(" · ")}</Link></td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.buscas_ok}/{r.total_buscas}</td>
                  <td className={`px-3 py-2 ${r.erro ? "text-red-600" : ""}`}>{r.erro ? "Parada" : STATUS[r.status] ?? r.status}</td>
                  <td className="px-3 py-2"><BotoesRepetir rodada={r.id} criadaEm={r.criado_em} compacto /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
