import Link from "next/link";
import { db } from "@/lib/supabase";
import { ordemPrioridade } from "@/lib/regras";
import { COR_FORCA, COR_PRIORIDADE, linkWhats } from "@/components/selos";
import { CampoData, CampoResponsavel, CampoStatus, STATUS } from "./campos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

type SP = { prioridade?: string; status?: string; q?: string; regiao?: string };

export default async function Leads({ searchParams }: { searchParams: Promise<SP> }) {
  const f = await searchParams;
  let consulta = db().from("leads")
    .select("id, prioridade, telefone_principal, outros_telefones, observacoes, status, responsavel_id, data_contato, forca, presenca, regioes, atualizado_em, cnpj, razao_social, advertisers(dominio, nome)")
    .limit(2000);
  if (f.prioridade) consulta = consulta.eq("prioridade", f.prioridade);
  if (f.status) consulta = consulta.eq("status", f.status);
  if (f.regiao) consulta = consulta.contains("regioes", [f.regiao]);
  const [leads, equipe] = await Promise.all([
    consulta, db().from("equipe").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  type L = { id: number; prioridade: string | null; telefone_principal: string | null; outros_telefones: string[];
    observacoes: string[]; status: string; responsavel_id: number | null; data_contato: string | null; forca: string | null;
    presenca: number | null; regioes: string[]; atualizado_em: string; cnpj: string | null; razao_social: string | null; advertisers: { dominio: string; nome: string | null } };
  const q = (f.q ?? "").toLowerCase().trim();
  const lista = ((leads.data ?? []) as unknown as L[])
    .filter((l) => !q || l.advertisers.dominio.includes(q) || (l.advertisers.nome ?? "").toLowerCase().includes(q)
      || (l.telefone_principal ?? "").includes(q) || (l.razao_social ?? "").toLowerCase().includes(q) || (l.cnpj ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "#"))
    .sort((a, b) => ordemPrioridade(a.prioridade ?? "") - ordemPrioridade(b.prioridade ?? "") || Number(a.presenca ?? 0) - Number(b.presenca ?? 0));
  const cnpjRepetido = new Map<string, number>();
  for (const l of (leads.data ?? []) as unknown as L[]) if (l.cnpj) cnpjRepetido.set(l.cnpj, (cnpjRepetido.get(l.cnpj) ?? 0) + 1);
  const regioes = [...new Set(((leads.data ?? []) as unknown as L[]).flatMap((l) => l.regioes))].sort();

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Leads</h1>
      {leads.error && <p className="text-sm text-red-600">{leads.error.message} — rodou o 0004_sites_leads.sql?</p>}

      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={f.q} placeholder="Buscar nome, site, telefone ou CNPJ" className="campo w-full sm:w-64" />
        <select name="prioridade" defaultValue={f.prioridade ?? ""} className="campo">
          <option value="">Toda prioridade</option>
          {["Máxima", "Alta", "Normal", "Baixa"].map((p) => <option key={p}>{p}</option>)}
        </select>
        <select name="status" defaultValue={f.status ?? ""} className="campo">
          <option value="">Todo status</option>
          {STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
        {regioes.length > 1 && (
          <select name="regiao" defaultValue={f.regiao ?? ""} className="campo">
            <option value="">Todas as regiões</option>
            {regioes.map((r) => <option key={r}>{r}</option>)}
          </select>
        )}
        <button className="botao-sec">Filtrar</button>
        <span className="self-center text-sm text-suave">{lista.length} leads</span>
      </form>

      {lista.length === 0 ? (
        <p className="cartao p-4 text-sm text-suave">
          Nenhum lead ainda. Os leads aparecem quando uma rodada termina de verificar os sites.
        </p>
      ) : (
        <div className="cartao overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-suave">
              <tr>
                <th className="px-3 py-2">Prioridade</th><th className="px-3 py-2">Anunciante</th>
                <th className="px-3 py-2">Telefone</th><th className="px-3 py-2">Força</th>
                <th className="px-3 py-2">Observações</th>
                <th className="bg-yellow-50 px-3 py-2">Status</th><th className="bg-yellow-50 px-3 py-2">Responsável</th>
                <th className="bg-yellow-50 px-3 py-2">Contato</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id} className="border-t border-borda align-top">
                  <td className="px-3 py-2">
                    {l.prioridade && <span className={`selo ${COR_PRIORIDADE[l.prioridade] ?? ""}`}>{l.prioridade}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:underline">{l.advertisers.nome ?? l.advertisers.dominio}</Link>
                    <span className="block text-xs text-suave">{l.advertisers.dominio.replace("perfil-google:", "perfil Google: ")}</span>
                    {(l.razao_social || l.cnpj) && (
                      <span className="block text-[11px]">
                        {l.razao_social}{l.cnpj && <span className="ml-1 font-mono text-suave">{l.cnpj}</span>}
                        {l.cnpj && (cnpjRepetido.get(l.cnpj) ?? 0) > 1 && (
                          <span className="selo ml-1 bg-red-100 text-red-800">mesmo CNPJ em {cnpjRepetido.get(l.cnpj)} sites</span>
                        )}
                      </span>
                    )}
                    <span className="block text-[11px] text-suave">{l.regioes.join(", ")}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {l.telefone_principal ? (
                      <>
                        <a href={`tel:${l.telefone_principal.replace(/\D/g, "")}`} className="font-medium hover:underline">{l.telefone_principal}</a>
                        {linkWhats(l.telefone_principal) && (
                          <a href={linkWhats(l.telefone_principal)!} target="_blank" rel="noreferrer" className="ml-1 text-green-700 hover:underline">zap</a>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {l.forca && <span className={`selo ${COR_FORCA[l.forca] ?? ""}`}>{l.forca}</span>}
                    {l.presenca !== null && <span className="block text-xs text-suave">{Math.round(Number(l.presenca) * 100)}%</span>}
                  </td>
                  <td className="max-w-[380px] px-3 py-2 text-xs text-suave">
                    {l.observacoes.slice(0, 3).map((o) => <p key={o}>• {o}</p>)}
                    {l.observacoes.length > 3 && <Link href={`/leads/${l.id}`} className="text-marca">+{l.observacoes.length - 3}</Link>}
                  </td>
                  <td className="px-3 py-2"><CampoStatus id={l.id} valor={l.status} /></td>
                  <td className="px-3 py-2"><CampoResponsavel id={l.id} valor={l.responsavel_id} equipe={equipe.data ?? []} /></td>
                  <td className="px-3 py-2"><CampoData id={l.id} valor={l.data_contato} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
