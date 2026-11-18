import Link from "next/link";
import { db } from "@/lib/supabase";
import { ordemPrioridade } from "@/lib/regras";
import { COR_FORCA, COR_PRIORIDADE, linkWhats } from "@/components/selos";
import { CampoData, CampoResponsavel, CampoStatus } from "./campos";
import { STATUS_LEAD as STATUS } from "@/lib/status";
import { OptinWhatsApp } from "@/components/optin-whatsapp";
import { LembrarFiltros } from "@/components/lembrar-filtros";
import { FiltroMulti } from "./filtro-multi";
import { formatarData } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

type SP = { prioridade?: string; status?: string; q?: string; regiao?: string | string[]; rodada?: string | string[] };
const lista_ = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

export default async function Leads({ searchParams }: { searchParams: Promise<SP> }) {
  const f = await searchParams;
  const regioesSel = lista_(f.regiao);
  const rodadasSel = lista_(f.rodada).map(Number).filter(Boolean);
  const CAMPOS = "id, prioridade, telefone_principal, outros_telefones, observacoes, status, responsavel_id, data_contato, forca, presenca, regioes, atualizado_em, cnpj, razao_social, advertiser_id, advertisers(dominio, nome)";
  const filtrar = <T,>(c: T) => {
    let x = c as unknown as ReturnType<ReturnType<typeof db>["from"]>["select"] extends (...a: never[]) => infer R ? R : never;
    if (f.prioridade) x = x.eq("prioridade", f.prioridade);
    if (f.status) x = x.eq("status", f.status);
    if (regioesSel.length) x = x.overlaps("regioes", regioesSel);
    return x;
  };

  // Leads das rodadas escolhidas: anunciantes que apareceram nelas
  let leads: { data: unknown[] | null; error: { message: string } | null };
  if (rodadasSel.length) {
    const advIds = new Set<number>();
    for (let de = 0; ; de += 1000) {
      const { data } = await db().from("run_advertisers").select("advertiser_id").in("run_id", rodadasSel).order("id").range(de, de + 999);
      for (const r of data ?? []) advIds.add(r.advertiser_id as number);
      if (!data || data.length < 1000) break;
    }
    const ids = [...advIds], dados: unknown[] = [];
    let erro: { message: string } | null = null;
    for (let i = 0; i < ids.length; i += 300) {
      const r = await filtrar(db().from("leads").select(CAMPOS)).in("advertiser_id", ids.slice(i, i + 300)).limit(2000);
      if (r.error) erro = r.error;
      dados.push(...(r.data ?? []));
    }
    leads = { data: dados, error: erro };
  } else {
    leads = await filtrar(db().from("leads").select(CAMPOS)).limit(2000);
  }
  const [equipe, rodadasDb, todasRegioes] = await Promise.all([
    db().from("equipe").select("id, nome").eq("ativo", true).order("nome"),
    db().from("runs").select("id, criado_em, termos, status").order("id", { ascending: false }).limit(60),
    db().from("regions").select("nome").order("nome"),
  ]);
  type L = { id: number; prioridade: string | null; telefone_principal: string | null; outros_telefones: string[];
    observacoes: string[]; status: string; responsavel_id: number | null; data_contato: string | null; forca: string | null;
    presenca: number | null; regioes: string[]; atualizado_em: string; cnpj: string | null; razao_social: string | null; advertisers: { dominio: string; nome: string | null } };
  const q = (f.q ?? "").toLowerCase().trim();
  const lista = ((leads.data ?? []) as unknown as L[])
    .filter((l) => !q || l.advertisers.dominio.includes(q) || (l.advertisers.nome ?? "").toLowerCase().includes(q)
      || (l.telefone_principal ?? "").includes(q) || (l.razao_social ?? "").toLowerCase().includes(q) || (l.cnpj ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "#"))
    .sort((a, b) => ordemPrioridade(a.prioridade ?? "") - ordemPrioridade(b.prioridade ?? "") || Number(a.presenca ?? 0) - Number(b.presenca ?? 0));
  const tels = [...new Set(lista.map((l) => "55" + (l.telefone_principal ?? "").replace(/\D/g, "")).filter((t) => t.length === 13))];
  const contatosWa = new Map<string, { optin_em: string | null; optout_em: string | null }>();
  for (let i = 0; i < tels.length; i += 300) {
    const { data: cs } = await db().from("wa_contatos").select("telefone, optin_em, optout_em").in("telefone", tels.slice(i, i + 300));
    for (const c of cs ?? []) contatosWa.set(c.telefone, c);
  }
  const cnpjRepetido = new Map<string, number>();
  for (const l of (leads.data ?? []) as unknown as L[]) if (l.cnpj) cnpjRepetido.set(l.cnpj, (cnpjRepetido.get(l.cnpj) ?? 0) + 1);
  const regioes = (todasRegioes.data ?? []).map((r) => r.nome as string);
  const opRodadas = (rodadasDb.data ?? []).map((r) => ({
    valor: String(r.id),
    texto: `#${r.id} · ${formatarData(r.criado_em)} · ${(Array.isArray(r.termos) ? r.termos : []).slice(0, 3).join(", ")}${r.status !== "pronta" ? ` (${r.status})` : ""}`,
  }));

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4">
      <LembrarFiltros chave="leads" />
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Leads</h1>
        <Link href="/leads?limpar=1" className="text-xs text-marca hover:underline">limpar filtros</Link>
      </div>
      {leads.error && <p className="text-sm text-red-600">{leads.error.message} — rodou o 0004_sites_leads.sql?</p>}

      {/* key: quando os filtros voltam do "lembrar", o formulário recomeça já com eles */}
      <form key={JSON.stringify(f)} className="flex flex-wrap gap-2">
        <input name="q" defaultValue={f.q} placeholder="Buscar nome, site, telefone ou CNPJ" className="campo w-full sm:w-64" />
        <select name="prioridade" defaultValue={f.prioridade ?? ""} className="campo">
          <option value="">Toda prioridade</option>
          {["Máxima", "Alta", "Normal", "Baixa"].map((p) => <option key={p}>{p}</option>)}
        </select>
        <select name="status" defaultValue={f.status ?? ""} className="campo">
          <option value="">Todo status</option>
          {STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <FiltroMulti nome="rodada" rotulo="Rodadas" todos="Todas as rodadas" opcoes={opRodadas} marcados={rodadasSel.map(String)} />
        <FiltroMulti nome="regiao" rotulo="Regiões" todos="Todas as regiões" opcoes={regioes.map((r) => ({ valor: r, texto: r }))} marcados={regioesSel} />
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
                        {linkWhats(l.telefone_principal) && (() => {
                          const c = contatosWa.get("55" + l.telefone_principal!.replace(/\D/g, ""));
                          return <span className="mt-1 block"><OptinWhatsApp leadId={l.id} autorizado={!!c?.optin_em} saiu={!!c?.optout_em} compacto /></span>;
                        })()}
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
