import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { formatarData } from "@/lib/utils";
import { progressoCampanha } from "@/lib/disparos";
import { ControleCampanha } from "./controle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campanha" };

const COR: Record<string, string> = {
  pendente: "text-suave", enviando: "text-marca", enviado: "", entregue: "text-blue-700", lido: "text-green-700",
  respondido: "font-semibold text-green-800", falhou: "text-red-600", ignorado: "text-suave",
};

export default async function Campanha({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { data: c } = await db().from("wa_campanhas").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [prog, envios] = await Promise.all([
    progressoCampanha(id),
    db().from("wa_envios").select("id, telefone, status, erro, enviado_em, parametros, lead_id, leads(advertisers(dominio, nome))")
      .eq("campanha_id", id).order("id").limit(2000),
  ]);
  type E = { id: number; telefone: string; status: string; erro: string | null; enviado_em: string | null; parametros: string[];
    lead_id: number | null; leads: { advertisers: { dominio: string; nome: string | null } } | null };
  const lista = (envios.data ?? []) as unknown as E[];

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <Link href="/disparos" className="text-xs text-marca hover:underline">← Disparos</Link>
        <h1 className="text-xl font-semibold">{c.nome}</h1>
        <p className="text-xs text-suave">Modelo {c.modelo_nome} · {c.total} contatos · {c.ritmo_por_minuto}/min · criada {formatarData(c.criado_em)}</p>
      </div>
      <ControleCampanha id={id} inicial={prog} />
      <div className="cartao overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-suave">
            <tr><th className="px-3 py-2">Contato</th><th className="px-3 py-2">WhatsApp</th><th className="px-3 py-2">Variáveis</th>
              <th className="px-3 py-2">Status</th><th className="px-3 py-2">Enviado</th></tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id} className="border-t border-borda align-top">
                <td className="px-3 py-2">
                  {e.lead_id ? <Link href={`/leads/${e.lead_id}`} className="hover:underline">{e.leads?.advertisers.nome ?? e.leads?.advertisers.dominio ?? "lead"}</Link> : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">+{e.telefone}</td>
                <td className="max-w-[360px] px-3 py-2 text-xs text-suave">{e.parametros.join(" · ")}</td>
                <td className={`px-3 py-2 ${COR[e.status] ?? ""}`} title={e.erro ?? ""}>
                  {e.status}{e.erro && <span className="block text-[11px] text-red-600">{e.erro}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-suave">{formatarData(e.enviado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
