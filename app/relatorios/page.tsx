import Link from "next/link";
import { db } from "@/lib/supabase";
import { carregarRodada } from "@/lib/rodada-dados";
import { montarDonos } from "@/lib/donos";
import { donosParaContatos } from "@/lib/exportar";
import { formatarData } from "@/lib/utils";
import { RelatorioLigacao } from "../rodadas/[id]/relatorio";
import { SeletorRodada } from "./seletor";
import type { Linha } from "@/lib/linha";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatórios" };

/** Barras horizontais simples: rótulo, valor e % do total. Uma cor só; a identidade está no rótulo. */
function Barras({ titulo, itens, total, unidade }: {
  titulo: string; itens: { rotulo: string; valor: number; destaque?: boolean }[]; total: number; unidade: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="cartao p-4">
      <h3 className="mb-3 text-sm font-semibold">{titulo}</h3>
      <div className="space-y-2.5">
        {itens.map((i) => (
          <div key={i.rotulo} title={`${i.rotulo}: ${i.valor} ${unidade} (${total ? Math.round((i.valor / total) * 100) : 0}%)`}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{i.rotulo}</span>
              <span className="tabular-nums text-suave">
                <strong className="text-texto">{i.valor}</strong> · {total ? Math.round((i.valor / total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${i.destaque ? "bg-red-600" : "bg-marca"}`}
                style={{ width: `${i.valor ? Math.max(2, (i.valor / max) * 100) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function Relatorios({ searchParams }: { searchParams: Promise<{ rodada?: string }> }) {
  const { rodada } = await searchParams;
  const { data: rodadas } = await db().from("runs").select("id, criado_em, termos, status")
    .eq("status", "pronta").order("id", { ascending: false }).limit(50);
  const lista = rodadas ?? [];
  if (!lista.length) {
    return (
      <main className="mx-auto max-w-6xl p-4">
        <h1 className="text-xl font-semibold">Relatórios</h1>
        <p className="mt-2 text-sm text-suave">Nenhuma rodada pronta ainda. <Link href="/" className="text-marca hover:underline">Fazer uma pesquisa</Link></p>
      </main>
    );
  }
  const id = Number(rodada) || lista[0].id;
  const dados = await carregarRodada(id);
  return <ConteudoRelatorio id={id} lista={lista} linhas={dados?.linhas ?? []} />;
}

export function ConteudoRelatorio({ id, lista, linhas }: {
  id: number; lista: { id: number; criado_em: string; termos: unknown }[]; linhas: Linha[];
}) {
  const donos = montarDonos(linhas);

  // --- números ---
  const sites = [...new Map(linhas.map((l) => [l.advertiserId, l])).values()];
  const conta = (p: string) => donos.filter((d) => d.prioridade === p).length;
  const bons = conta("Máxima") + conta("Alta");
  const ruins = conta("Baixa");
  const gruposMulti = donos.filter((d) => d.sites.length > 1);
  const sitesDuplicados = gruposMulti.reduce((s, d) => s + d.sites.length, 0);
  const duasContas = sites.filter((l) => linhas.some((x) => x.advertiserId === l.advertiserId && x.duplicado > 0)).length;
  const sit = (s: string) => sites.filter((l) => l.situacao === s).length;
  const palavraErrada = sites.filter((l) => l.termoNoSite === false && !linhas.some((x) => x.advertiserId === l.advertiserId && x.termoNoSite === true));
  const palavraVerificada = sites.filter((l) => l.termoNoSite !== null).length;
  const semTag = sites.filter((l) => l.situacao === "ok" && l.tagGoogle === "nao").length;
  const semTelefone = donos.filter((d) => !d.telefone).length;
  const forcas = (f: string) => sites.filter((l) => linhas.filter((x) => x.advertiserId === l.advertiserId)
    .sort((a, b) => b.presenca - a.presenca)[0]?.forca === f).length;
  const zap = donosParaContatos(donos, "whatsapp").length;
  const comTelefone = donosParaContatos(donos, "ligar").length;

  const rotulo = (r: { id: number; criado_em: string; termos: unknown }) =>
    `#${r.id} · ${formatarData(r.criado_em)} · ${(r.termos as string[]).join(", ")}`;
  const exp = (formato: string, quem: string) => `/api/runs/${id}/exportar?formato=${formato}&quem=${quem}`;

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <SeletorRodada atual={id} rodadas={lista.map((r) => ({ id: r.id, rotulo: rotulo(r) }))} />
          <p className="text-xs text-suave">
            {[...new Set(linhas.map((l) => l.regiao))].join(", ")} · {sites.length} sites · {donos.length} donos ·{" "}
            <Link href={`/rodadas/${id}`} className="text-marca hover:underline">abrir a rodada</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={exp("xml", "whatsapp")} className="botao">Exportar telefones (XML) · {zap} WhatsApp</a>
          <details className="relative">
            <summary className="botao-sec cursor-pointer list-none">Outras opções ▾</summary>
            <div className="absolute right-0 z-10 mt-1 w-72 space-y-1 rounded-lg border border-borda bg-white p-2 text-sm shadow-lg">
              <a href={exp("xml", "ligar")} className="block rounded px-2 py-1.5 hover:bg-slate-50">XML · todos para ligar ({comTelefone}, inclui fixos)</a>
              <a href={exp("xml", "todos")} className="block rounded px-2 py-1.5 hover:bg-slate-50">XML · todos, inclusive "não priorizar"</a>
              <a href={exp("csv", "whatsapp")} className="block rounded px-2 py-1.5 hover:bg-slate-50">CSV (Excel) · só WhatsApp</a>
              <a href={exp("csv", "ligar")} className="block rounded px-2 py-1.5 hover:bg-slate-50">CSV (Excel) · todos para ligar</a>
            </div>
          </details>
        </div>
      </div>

      {/* Números principais */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {[
          { n: bons, rotulo: "bons para ligar", sub: "prioridade Máxima ou Alta", cor: "text-green-700" },
          { n: conta("Normal"), rotulo: "normais", sub: "anúncio forte", cor: "text-texto" },
          { n: ruins, rotulo: "ruins para ligar", sub: "rede, 0800 ou agência", cor: "text-suave" },
          { n: conta("Máxima"), rotulo: "com erro no site", sub: "fora do ar / suspenso / domínio", cor: conta("Máxima") ? "text-red-600" : "text-texto" },
          { n: gruposMulti.length, rotulo: "donos com 2+ sites", sub: `${sitesDuplicados} sites duplicados`, cor: "text-texto" },
          { n: palavraErrada.length, rotulo: "palavra-chave errada", sub: `de ${palavraVerificada} sites lidos`, cor: palavraErrada.length ? "text-purple-700" : "text-texto" },
        ].map((c) => (
          <div key={c.rotulo} className="cartao p-3">
            <p className={`text-3xl font-semibold tabular-nums ${c.cor}`}>{c.n}</p>
            <p className="text-sm">{c.rotulo}</p>
            <p className="text-[11px] text-suave">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid gap-3 md:grid-cols-3">
        <Barras titulo="Probabilidade (por dono)" unidade="donos" total={donos.length} itens={[
          { rotulo: "Máxima — site com erro, ligar já", valor: conta("Máxima"), destaque: true },
          { rotulo: "Alta — anúncio fraco/médio", valor: conta("Alta") },
          { rotulo: "Normal — anúncio forte", valor: conta("Normal") },
          { rotulo: "Baixa — rede / 0800", valor: conta("Baixa") },
        ]} />
        <Barras titulo="Problemas encontrados (por site)" unidade="sites" total={sites.length} itens={[
          { rotulo: "Site fora do ar", valor: sit("fora_do_ar"), destaque: true },
          { rotulo: "Hospedagem suspensa", valor: sit("suspenso"), destaque: true },
          { rotulo: "Domínio não existe", valor: sit("dns"), destaque: true },
          { rotulo: "Palavra-chave errada", valor: palavraErrada.length },
          { rotulo: "Sem tag do Google Ads", valor: semTag },
          { rotulo: "Duas contas na mesma busca", valor: duasContas },
          { rotulo: "Site bloqueia robô (conferir)", valor: sit("bloqueado") },
        ]} />
        <Barras titulo="Força do anúncio (por site)" unidade="sites" total={sites.length} itens={[
          { rotulo: "Fraca — aparece em < 40% das buscas", valor: forcas("Fraca") },
          { rotulo: "Média — 40% a 75%", valor: forcas("Média") },
          { rotulo: "Forte — > 75%", valor: forcas("Forte") },
          { rotulo: "Sem telefone no site (por dono)", valor: semTelefone },
        ]} />
      </div>

      {/* Palavra-chave errada */}
      {palavraErrada.length > 0 && (
        <section className="cartao p-4">
          <h2 className="font-semibold">Anunciando na palavra-chave errada ({palavraErrada.length})</h2>
          <p className="mb-3 text-xs text-suave">
            Apareceram na busca, mas o site não fala desse serviço. Estão pagando clique de quem procura outra coisa: argumento forte para a abordagem.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase text-suave">
                <tr className="border-b border-borda"><th className="py-1.5 pr-3">Empresa</th><th className="pr-3">Site</th>
                  <th className="pr-3">Buscou e o site não fala de</th><th>Telefone</th></tr>
              </thead>
              <tbody>
                {palavraErrada.map((l) => (
                  <tr key={l.advertiserId} className="border-b border-borda last:border-0">
                    <td className="py-1.5 pr-3">{l.leadId ? <Link href={`/leads/${l.leadId}`} className="hover:underline">{l.razaoSocial ?? l.nome ?? l.dominio}</Link> : (l.razaoSocial ?? l.nome ?? l.dominio)}</td>
                    <td className="pr-3"><a href={`https://${l.dominio}`} target="_blank" rel="noreferrer" className="text-marca hover:underline">{l.dominio}</a></td>
                    <td className="pr-3 text-xs">{[...new Set(linhas.filter((x) => x.advertiserId === l.advertiserId).flatMap((x) => x.termosAusentes))].join(", ")}</td>
                    <td className="whitespace-nowrap text-xs">{l.telefone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {linhas.length > 0
        ? <RelatorioLigacao linhas={linhas} semResumo titulo="Lista para ligar (um dono por linha)" />
        : <p className="cartao p-4 text-sm text-suave">Esta rodada não tem anunciantes.</p>}
    </main>
  );
}
