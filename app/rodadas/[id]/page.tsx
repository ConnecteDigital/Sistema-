import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { progresso } from "@/lib/motor";
import { formatarData } from "@/lib/utils";
import { Executor } from "./executor";
import { BotoesRepetir } from "@/components/botoes-repetir";
import { TabelaAnunciantes } from "./tabela";
import { RelatorioLigacao } from "./relatorio";
import { buscarLinhasBanco, montarLinhas } from "@/lib/rodada-dados";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rodada" };

export default async function Rodada({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const id = Number((await params).id);
  const { erro: erroRepetir } = await searchParams;
  if (!Number.isInteger(id)) notFound();
  const { data: run } = await db().from("runs").select("*").eq("id", id).maybeSingle();
  if (!run) notFound();

  const [prog, anunc, buscas] = await Promise.all([
    progresso(id),
    buscarLinhasBanco(id),
    db().from("run_searches")
      .select("id, termo, status, qtd_anuncios, erro, location_usada, locations(nome_exibicao, regions(nome))")
      .eq("run_id", id).order("id").limit(5000),
  ]);

  const linhas = await montarLinhas(anunc, prog.status === "pronta");
  const semLeads = prog.status === "pronta" && linhas.length > 0 &&
    linhas.some((l) => !l.prioridade || (!l.dominio.startsWith("perfil-google:") && !l.cnpj));

  type B = { id: number; termo: string; status: string; qtd_anuncios: number | null; erro: string | null;
    location_usada: string | null; locations: { nome_exibicao: string; regions: { nome: string } } };
  const listaBuscas = (buscas.data ?? []) as unknown as B[];
  const pontos = [...new Set(listaBuscas.map((b) => b.locations.nome_exibicao))];
  const regioes = [...new Set(listaBuscas.map((b) => b.locations.regions.nome))];

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-suave">Rodada #{id} · {formatarData(run.criado_em)}</p>
          <h1 className="text-xl font-semibold">{(run.termos as string[]).join(" · ")}</h1>
          <p className="text-sm text-suave">
          {regioes.join(", ")} · {pontos.length} pontos · {run.total_buscas} buscas · celular
          </p>
        </div>
        <BotoesRepetir rodada={id} criadaEm={run.criado_em} />
      </div>
      {erroRepetir && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">Não deu para repetir: {erroRepetir}</p>}

      <Executor runId={id} inicial={prog} semLeads={semLeads} />

      {prog.status === "pronta" && linhas.some((l) => l.prioridade) && <RelatorioLigacao linhas={linhas} />}

      {linhas.length > 0 ? (
        <TabelaAnunciantes linhas={linhas} />
      ) : prog.status === "pronta" ? (
        <p className="cartao p-4 text-sm text-suave">Nenhum anúncio encontrado nesta rodada.</p>
      ) : null}

      <details className="cartao p-4 text-sm">
        <summary className="cursor-pointer font-medium">Buscas ({listaBuscas.length})</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead className="text-left uppercase text-suave">
              <tr><th className="py-1 pr-3">Ponto</th><th className="pr-3">Termo</th><th className="pr-3">Status</th>
                <th className="pr-3 text-right">Anúncios</th><th>Local usado pela SerpApi</th></tr>
            </thead>
            <tbody>
              {listaBuscas.map((b) => (
                <tr key={b.id} className="border-t border-borda">
                  <td className="py-1 pr-3">{b.locations.nome_exibicao}</td>
                  <td className="pr-3">{b.termo}</td>
                  <td className={`pr-3 ${b.status === "erro" ? "text-red-600" : ""}`} title={b.erro ?? ""}>{b.status}</td>
                  <td className="pr-3 text-right tabular-nums">{b.qtd_anuncios ?? "—"}</td>
                  <td className="text-suave">{b.location_usada ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </main>
  );
}
