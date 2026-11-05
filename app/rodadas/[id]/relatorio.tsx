import Link from "next/link";
import { COR_PRIORIDADE, linkWhats } from "@/components/selos";
import { BotaoCopiar } from "./copiar";
import type { Linha } from "./tabela";

const PESO: Record<string, number> = { "Máxima": 0, Alta: 1, Normal: 2, Baixa: 3 };
const pct = (v: number) => `${Math.round(v * 100)}%`;

type Dono = {
  principal: Linha; sites: string[]; regioes: string[]; prioridade: string; presenca: number;
  telefone: string | null; empresa: string; cnpj: string | null;
};

/** Um dono por linha (sites com mesmo CNPJ/telefone/tag juntos), na ordem de quem ligar primeiro. */
function montarDonos(linhas: Linha[]): Dono[] {
  const porGrupo = new Map<number, Linha[]>();
  for (const l of linhas) {
    if (!porGrupo.has(l.grupo)) porGrupo.set(l.grupo, []);
    porGrupo.get(l.grupo)!.push(l);
  }
  const donos: Dono[] = [];
  for (const ls of porGrupo.values()) {
    const ord = [...ls].sort((a, b) => (PESO[a.prioridade ?? ""] ?? 9) - (PESO[b.prioridade ?? ""] ?? 9) || a.presenca - b.presenca);
    const p = ord[0];
    const comTel = ord.find((x) => x.telefone);
    const comCnpj = ord.find((x) => x.razaoSocial || x.cnpjPrincipal);
    donos.push({
      principal: p, sites: [...new Set(ls.map((x) => x.dominio))], regioes: [...new Set(ls.map((x) => x.regiao))],
      prioridade: p.prioridade ?? "Normal", presenca: Math.max(...ls.map((x) => x.presenca)),
      telefone: comTel?.telefone ?? null,
      empresa: comCnpj?.razaoSocial ?? p.nome ?? p.dominio, cnpj: comCnpj?.cnpjPrincipal ?? null,
    });
  }
  return donos.sort((a, b) => (PESO[a.prioridade] ?? 9) - (PESO[b.prioridade] ?? 9) || a.presenca - b.presenca);
}

export function RelatorioLigacao({ linhas }: { linhas: Linha[] }) {
  const donos = montarDonos(linhas);
  const ligar = donos.filter((d) => d.prioridade !== "Baixa");
  const conta = (p: string) => donos.filter((d) => d.prioridade === p).length;
  const foraDoAr = conta("Máxima");
  const gruposMultiplos = donos.filter((d) => d.sites.length > 1);
  const jaContatados = ligar.filter((d) => d.principal.statusLead && d.principal.statusLead !== "A contatar").length;

  const texto = ligar.map((d, i) => [
    `${i + 1}. [${d.prioridade}] ${d.empresa}${d.cnpj ? ` (CNPJ ${d.cnpj})` : ""}`,
    `   ${d.telefone ?? "sem telefone"} · ${d.sites.join(", ")} · presença ${pct(d.presenca)}`,
    d.principal.observacoes[0] ? `   ${d.principal.observacoes[0]}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");

  return (
    <section className="cartao space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Relatório — quem ligar</h2>
        <BotaoCopiar texto={texto} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { n: ligar.length, rotulo: "para ligar", cor: "text-marca" },
          { n: foraDoAr, rotulo: "site fora do ar (ligar já)", cor: foraDoAr ? "text-red-600" : "text-texto" },
          { n: conta("Alta"), rotulo: "prioridade alta", cor: "text-orange-700" },
          { n: gruposMultiplos.length, rotulo: "donos com 2+ sites", cor: "text-texto" },
          { n: conta("Baixa"), rotulo: "não priorizar (rede/0800)", cor: "text-suave" },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-lg bg-slate-50 p-3">
            <p className={`text-2xl font-semibold tabular-nums ${c.cor}`}>{c.n}</p>
            <p className="text-xs text-suave">{c.rotulo}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-suave">
        {linhas.length} sites viraram {donos.length} donos diferentes (mesmo CNPJ, telefone ou tag do Google = mesmo dono).
        {jaContatados > 0 && ` ${jaContatados} já tem status diferente de "A contatar".`}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-xs uppercase text-suave">
            <tr className="border-b border-borda">
              <th className="py-2 pr-2">#</th><th className="pr-3">Prioridade</th><th className="pr-3">Empresa</th>
              <th className="pr-3">Telefone</th><th className="pr-3">Por que ligar</th><th className="pr-3 text-right">Presença</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ligar.map((d, i) => (
              <tr key={d.principal.grupo} className="border-b border-borda align-top last:border-0">
                <td className="py-2 pr-2 text-suave tabular-nums">{i + 1}</td>
                <td className="pr-3"><span className={`selo ${COR_PRIORIDADE[d.prioridade] ?? ""}`}>{d.prioridade}</span></td>
                <td className="max-w-[260px] pr-3">
                  {d.principal.leadId
                    ? <Link href={`/leads/${d.principal.leadId}`} className="font-medium hover:underline">{d.empresa}</Link>
                    : <span className="font-medium">{d.empresa}</span>}
                  {d.cnpj && <span className="block font-mono text-[11px] text-suave">CNPJ {d.cnpj}</span>}
                  <span className="block text-xs text-suave">{d.sites.join(" · ").replaceAll("perfil-google:", "perfil Google: ")}</span>
                  {d.sites.length > 1 && <span className="selo mt-0.5 bg-red-100 text-red-800">mesmo dono: {d.sites.length} sites</span>}
                </td>
                <td className="whitespace-nowrap pr-3 text-xs">
                  {d.telefone ? (
                    <>
                      <a href={`tel:${d.telefone.replace(/\D/g, "")}`} className="text-sm font-semibold hover:underline">{d.telefone}</a>
                      {linkWhats(d.telefone) && (
                        <a href={linkWhats(d.telefone)!} target="_blank" rel="noreferrer" className="ml-1 text-green-700 hover:underline">zap</a>
                      )}
                    </>
                  ) : <span className="text-suave">abrir o anúncio no celular</span>}
                </td>
                <td className="max-w-[340px] pr-3 text-xs">
                  {d.principal.observacoes.slice(0, 2).map((o) => <p key={o}>• {o}</p>)}
                </td>
                <td className="pr-3 text-right tabular-nums">{pct(d.presenca)}<span className="block text-[11px] text-suave">{d.regioes.join(", ")}</span></td>
                <td className="text-xs">{d.principal.statusLead ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
