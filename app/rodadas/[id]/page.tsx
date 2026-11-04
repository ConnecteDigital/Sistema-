import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { progresso } from "@/lib/motor";
import { formatarData } from "@/lib/utils";
import { Executor } from "./executor";
import { TabelaAnunciantes, type Linha } from "./tabela";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rodada" };

export default async function Rodada({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { data: run } = await db().from("runs").select("*").eq("id", id).maybeSingle();
  if (!run) notFound();

  const [prog, anunc, buscas] = await Promise.all([
    progresso(id),
    db().from("run_advertisers")
      .select("id, advertiser_id, aparicoes, buscas, presenca, pontos, termos, pos_media, pct_topo, pct_sitelinks, titulo, link, forca, nome, duplicado_mesma_busca, advertisers(dominio, nome), regions(nome)")
      .eq("run_id", id).limit(5000),
    db().from("run_searches")
      .select("id, termo, status, qtd_anuncios, erro, location_usada, locations(nome_exibicao, regions(nome))")
      .eq("run_id", id).order("id").limit(5000),
  ]);

  type A = { id: number; advertiser_id: number; aparicoes: number; buscas: number; presenca: number; pontos: string[]; termos: string[];
    pos_media: number | null; pct_topo: number; pct_sitelinks: number; titulo: string | null; link: string | null;
    forca: string; nome: string | null; duplicado_mesma_busca: number;
    advertisers: { dominio: string; nome: string | null }; regions: { nome: string } };
  const listaA = (anunc.data ?? []) as unknown as A[];
  const advIds = [...new Set(listaA.map((a) => a.advertiser_id))];
  const [leads, sites, cnpjs] = advIds.length ? await Promise.all([
    db().from("leads").select("id, advertiser_id, prioridade, telefone_principal, outros_telefones, observacoes").in("advertiser_id", advIds),
    db().from("site_checks_recentes").select("advertiser_id, situacao, tag_google").in("advertiser_id", advIds),
    db().from("consultas_cnpj").select("advertiser_id, resultado, consultado_em").in("advertiser_id", advIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const leadPor = new Map((leads.data ?? []).map((l) => [l.advertiser_id, l]));
  const sitePor = new Map((sites.data ?? []).map((c) => [c.advertiser_id, c]));
  const cnpjPor = new Map((cnpjs.data ?? []).map((c) => [c.advertiser_id, c]));

  const linhas: Linha[] = listaA.map((a) => ({
    id: a.id, regiao: a.regions.nome, dominio: a.advertisers.dominio, nome: a.nome ?? a.advertisers.nome,
    aparicoes: a.aparicoes, buscas: a.buscas, presenca: Number(a.presenca), pontos: a.pontos, termos: a.termos,
    pos_media: a.pos_media === null ? null : Number(a.pos_media), pct_topo: Number(a.pct_topo),
    pct_sitelinks: Number(a.pct_sitelinks), titulo: a.titulo, link: a.link, forca: a.forca, duplicado: a.duplicado_mesma_busca,
    advertiserId: a.advertiser_id, leadId: leadPor.get(a.advertiser_id)?.id ?? null,
    prioridade: leadPor.get(a.advertiser_id)?.prioridade ?? null,
    telefone: leadPor.get(a.advertiser_id)?.telefone_principal ?? null,
    outrosTelefones: leadPor.get(a.advertiser_id)?.outros_telefones ?? [],
    observacoes: prog.status === "pronta" ? (leadPor.get(a.advertiser_id)?.observacoes ?? []) : [],
    situacao: sitePor.get(a.advertiser_id)?.situacao ?? null, tagGoogle: sitePor.get(a.advertiser_id)?.tag_google ?? null,
    cnpj: cnpjPor.get(a.advertiser_id) ? { resultado: cnpjPor.get(a.advertiser_id)!.resultado, consultado_em: cnpjPor.get(a.advertiser_id)!.consultado_em } : null,
  }));
  const semLeads = prog.status === "pronta" && linhas.length > 0 && linhas.every((l) => !l.prioridade);

  type B = { id: number; termo: string; status: string; qtd_anuncios: number | null; erro: string | null;
    location_usada: string | null; locations: { nome_exibicao: string; regions: { nome: string } } };
  const listaBuscas = (buscas.data ?? []) as unknown as B[];
  const pontos = [...new Set(listaBuscas.map((b) => b.locations.nome_exibicao))];
  const regioes = [...new Set(listaBuscas.map((b) => b.locations.regions.nome))];

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4">
      <div>
        <p className="text-xs text-suave">Rodada #{id} · {formatarData(run.criado_em)}</p>
        <h1 className="text-xl font-semibold">{(run.termos as string[]).join(" · ")}</h1>
        <p className="text-sm text-suave">
          {regioes.join(", ")} · {pontos.length} pontos · {run.total_buscas} buscas · celular
        </p>
      </div>

      <Executor runId={id} inicial={prog} semLeads={semLeads} />

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
