import Link from "next/link";
import { COR_PRIORIDADE, ROTULO_SITUACAO, linkWhats } from "@/components/selos";
import { BotaoCopiar } from "./copiar";
import { BotaoPdf, type ItemPdf } from "./baixar-pdf";
import type { Linha } from "./tabela";

import { montarDonos, type Dono } from "@/lib/donos";
import { analisarAnuncio } from "@/lib/analise";
import { AnaliseAnuncio } from "@/components/analise-anuncio";
const pct = (v: number) => `${Math.round(v * 100)}%`;
const analiseDo = (d: Dono) => {
  const l = d.principal;
  return analisarAnuncio([{ regiao: l.regiao, presenca: l.presenca, aparicoes: l.aparicoes, buscas: l.buscas,
    posMedia: l.pos_media, pctTopo: l.pct_topo, pontos: l.pontos ?? [], termos: l.termos ?? [] }]);
};

export function RelatorioLigacao({ linhas, semResumo = false, titulo = "Relatório — quem ligar" }: { linhas: Linha[]; semResumo?: boolean; titulo?: string }) {
  const donos = montarDonos(linhas);
  const ligar = donos.filter((d) => d.prioridade !== "Baixa");
  const conta = (p: string) => donos.filter((d) => d.prioridade === p).length;
  const foraDoAr = conta("Máxima");
  const gruposMultiplos = donos.filter((d) => d.sites.length > 1);
  const jaContatados = ligar.filter((d) => d.principal.statusLead && d.principal.statusLead !== "A contatar").length;

  const texto = ligar.map((d, i) => {
    const a = analiseDo(d);
    return [
      `${i + 1}. [${d.prioridade}] ${d.empresa}${d.cnpj ? ` (CNPJ ${d.cnpj})` : ""}`,
      `   ${d.telefone ?? "sem telefone"} · ${d.sites.join(", ")} · presença ${pct(d.presenca)}`,
      ...d.principal.observacoes.slice(0, 2).map((o) => `   ${o}`),
      a ? `   Anúncio: ${a.resumo}` : "",
      a && !a.amostraPequena ? `   O que falar: "${a.abordagem}"` : "",
      ...(a?.cuidados ?? []).map((c) => `   Cuidado: ${c}`),
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const itensPdf: ItemPdf[] = ligar.map((d, i) => {
    const a = analiseDo(d);
    return {
      n: i + 1, prioridade: d.prioridade, empresa: d.empresa, cnpj: d.cnpj, telefone: d.telefone,
      sites: d.sites, regioes: d.regioes, presenca: pct(d.presenca), status: d.principal.statusLead ?? "—",
      porQue: d.principal.observacoes.slice(0, 2), resumo: a?.resumo ?? null,
      falar: a && !a.amostraPequena ? a.abordagem : null, cuidados: a?.cuidados ?? [],
    };
  });

  return (
    <section className="cartao space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <div className="flex flex-wrap gap-2">
          <BotaoCopiar texto={texto} />
          <BotaoPdf itens={itensPdf} titulo={titulo} />
        </div>
      </div>

      {!semResumo && <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
      </div>}
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
                  <span className="block text-xs">
                    {d.sites.map((s, i) => (
                      <span key={s}>
                        {i > 0 && " · "}
                        {s.startsWith("perfil-google:")
                          ? <span className="text-suave">perfil Google</span>
                          : <a href={`https://${s}`} target="_blank" rel="noreferrer" className="text-marca hover:underline">{s}</a>}
                      </span>
                    ))}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {d.sites.length > 1 && <span className="selo bg-red-100 text-red-800">mesmo dono: {d.sites.length} sites</span>}
                    {d.problemaSite && <span className="selo bg-red-600 text-white">{ROTULO_SITUACAO[d.problemaSite] ?? d.problemaSite}</span>}
                    {d.palavraErrada && <span className="selo bg-purple-100 text-purple-800">palavra-chave errada</span>}
                  </span>
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
                  {(() => {
                    const a = analiseDo(d);
                    if (!a) return null;
                    return (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-marca">Análise do anúncio e o que falar</summary>
                        <div className="mt-1"><AnaliseAnuncio a={a} compacto /></div>
                      </details>
                    );
                  })()}
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
