import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/supabase";
import { formatarData } from "@/lib/utils";
import { ConsultaCnpj } from "@/components/consulta-cnpj";
import { COR_FORCA, COR_PRIORIDADE, ROTULO_SITUACAO, ROTULO_TAG, linkWhats } from "@/components/selos";
import { CampoData, CampoNotas, CampoResponsavel, CampoStatus } from "../campos";
import { OutrosDominios } from "./outros-dominios";
import { ContaGoogleAds } from "@/components/conta-google-ads";
import { OptinWhatsApp } from "@/components/optin-whatsapp";
import { AnaliseAnuncio } from "@/components/analise-anuncio";
import { analisarAnuncio, rotuloForca } from "@/lib/analise";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lead" };

export default async function Lead({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { data: lead } = await db().from("leads").select("*, advertisers(id, dominio, nome, primeiro_visto, ultimo_visto)").eq("id", id).maybeSingle();
  if (!lead) notFound();
  const adv = lead.advertisers as { id: number; dominio: string; nome: string | null; primeiro_visto: string; ultimo_visto: string };

  const telE164 = (lead.telefone_principal ?? "").replace(/\D/g, "");
  const [historico, site, cnpj, eventos, equipe, outros, contaAds, waContato] = await Promise.all([
    db().from("run_advertisers")
      .select("run_id, presenca, aparicoes, buscas, forca, pos_media, pct_topo, pct_sitelinks, titulo, link, pontos, termos, regions(nome), runs(criado_em)")
      .eq("advertiser_id", adv.id).order("run_id", { ascending: false }).limit(50),
    db().from("site_checks_recentes").select("*").eq("advertiser_id", adv.id).maybeSingle(),
    db().from("consultas_cnpj").select("resultado, consultado_em").eq("advertiser_id", adv.id).maybeSingle(),
    db().from("lead_events").select("tipo, texto, criado_em").eq("lead_id", id).order("criado_em", { ascending: false }).limit(50),
    db().from("equipe").select("id, nome").eq("ativo", true).order("nome"),
    db().from("lead_dominios").select("dominio, resultado, consultado_em").eq("lead_id", id).order("consultado_em", { ascending: false }),
    db().from("contas_google_ads").select("status, resultado, erro, consultado_em, bruto").eq("advertiser_id", adv.id).maybeSingle(),
    db().from("wa_contatos").select("optin_em, optout_em").eq("telefone", "55" + telE164).maybeSingle(),
  ]);
  type H = { run_id: number; presenca: number; aparicoes: number; buscas: number; forca: string; pos_media: number | null;
    pct_topo: number; pct_sitelinks: number; titulo: string | null; link: string | null; pontos: string[]; termos: string[];
    regions: { nome: string }; runs: { criado_em: string } };
  const hist = (historico.data ?? []) as unknown as H[];
  const s = site.data;
  const perfil = adv.dominio.startsWith("perfil-google:");
  const analise = analisarAnuncio(hist.map((h) => ({
    rodada: h.run_id, data: h.runs.criado_em, regiao: h.regions.nome, presenca: Number(h.presenca), aparicoes: h.aparicoes,
    buscas: h.buscas, posMedia: h.pos_media === null ? null : Number(h.pos_media), pctTopo: Number(h.pct_topo),
    pontos: h.pontos ?? [], termos: h.termos ?? [],
  })));

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/leads" className="text-xs text-marca hover:underline">← Leads</Link>
          <h1 className="text-xl font-semibold">{adv.nome ?? adv.dominio}</h1>
          {!perfil && <a href={`https://${adv.dominio}`} target="_blank" rel="noreferrer" className="text-sm text-marca hover:underline">{adv.dominio}</a>}
          <p className="text-xs text-suave">Visto pela 1ª vez {formatarData(adv.primeiro_visto)} · última {formatarData(adv.ultimo_visto)}</p>
        </div>
        <div className="flex gap-2">
          {lead.prioridade && <span className={`selo text-sm ${COR_PRIORIDADE[lead.prioridade] ?? ""}`}>{lead.prioridade}</span>}
          {lead.forca && <span className={`selo text-sm ${COR_FORCA[lead.forca] ?? ""}`}>{lead.forca} · {Math.round(Number(lead.presenca) * 100)}%</span>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="cartao space-y-2 p-4 text-sm">
          <h2 className="font-semibold">Contato</h2>
          {lead.telefone_principal ? (
            <p className="text-lg font-semibold">
              <a href={`tel:${lead.telefone_principal.replace(/\D/g, "")}`} className="hover:underline">{lead.telefone_principal}</a>
              {linkWhats(lead.telefone_principal) && (
                <a href={linkWhats(lead.telefone_principal)!} target="_blank" rel="noreferrer" className="ml-2 text-sm text-green-700 hover:underline">WhatsApp</a>
              )}
            </p>
          ) : <p className="text-suave">Telefone não encontrado.</p>}
          {lead.outros_telefones?.length > 0 && <p className="text-xs text-suave">Outros: {lead.outros_telefones.join(" · ")}</p>}
          {telE164.length === 11 && (
            <OptinWhatsApp leadId={id} autorizado={!!waContato.data?.optin_em} saiu={!!waContato.data?.optout_em} />
          )}
          <div className="pt-1">{!perfil && <ConsultaCnpj advertiserId={adv.id} inicial={cnpj.data ?? null} />}</div>
        </section>
      </div>

      <section className="cartao space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Conta do Google Ads (quem paga o anúncio)</h2>
        {perfil
          ? <p className="text-xs text-suave">Sem site: procure o nome na <a href="https://adstransparency.google.com/?region=BR" target="_blank" rel="noreferrer" className="text-marca hover:underline">Central de Transparência</a>.</p>
          : <ContaGoogleAds advertiserId={adv.id} dominio={adv.dominio} inicial={contaAds.data ? { ...contaAds.data, diag: (contaAds.data as { bruto?: { diag?: unknown } }).bruto?.diag ?? null } : null} />}
      </section>

      <div className="grid gap-4 md:grid-cols-2">

        <section className="cartao space-y-2 bg-yellow-50/40 p-4 text-sm">
          <h2 className="font-semibold">Prospecção</h2>
          <div className="flex flex-wrap gap-2">
            <CampoStatus id={id} valor={lead.status} />
            <CampoResponsavel id={id} valor={lead.responsavel_id} equipe={equipe.data ?? []} />
            <CampoData id={id} valor={lead.data_contato} />
          </div>
          <CampoNotas id={id} valor={lead.notas} />
        </section>
      </div>

      <OutrosDominios leadId={id} itens={outros.data ?? []} />

      {analise && (
        <section className="cartao border-l-4 border-marca p-4">
          <h2 className="mb-2 font-semibold">Análise do anúncio</h2>
          <AnaliseAnuncio a={analise} />
        </section>
      )}

      {lead.observacoes?.length > 0 && (
        <section className="cartao p-4 text-sm">
          <h2 className="mb-2 font-semibold">Observações (argumentos)</h2>
          <ul className="list-inside list-disc space-y-1">{lead.observacoes.map((o: string) => <li key={o}>{o}</li>)}</ul>
        </section>
      )}

      <section className="cartao space-y-1 p-4 text-sm">
        <h2 className="mb-1 font-semibold">Site</h2>
        {s ? (
          <>
            <p>
              Situação: <strong className={["fora_do_ar", "suspenso", "dns"].includes(s.situacao) ? "text-red-700" : ""}>
                {ROTULO_SITUACAO[s.situacao] ?? s.situacao}</strong>
              {s.motivo && <> — {s.motivo}</>}
              {s.http_status && <span className="text-suave"> · HTTP {s.http_status} · {s.tempo_ms} ms</span>}
            </p>
            <p>Tag do Google Ads: <strong>{ROTULO_TAG[s.tag_google ?? ""] ?? "—"}</strong>
              {(s.tags_aw?.length > 0 || s.tags_gtm?.length > 0) && <span className="text-suave"> ({[...s.tags_aw, ...s.tags_gtm].join(", ")})</span>}
              {s.ga4?.length > 0 && <span className="text-suave"> · GA4 {s.ga4.join(", ")}</span>}
            </p>
            <p className="break-all text-xs text-suave">Página verificada: {s.url_final ?? s.url} · {formatarData(s.verificado_em)}</p>
          </>
        ) : <p className="text-suave">{perfil ? "O anúncio leva ao perfil do Google (sem site)." : "Ainda não verificado."}</p>}
      </section>

      <section className="cartao p-4 text-sm">
        <h2 className="mb-2 font-semibold">Aparições por rodada</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="text-left uppercase text-suave">
              <tr><th className="py-1 pr-3">Rodada</th><th className="pr-3">Região</th><th className="pr-3 text-right">Presença</th>
                <th className="pr-3">Força</th><th className="pr-3 text-right">Pos.</th><th className="pr-3">Pontos</th><th>Anúncio</th></tr>
            </thead>
            <tbody>
              {hist.map((h) => (
                <tr key={`${h.run_id}-${h.regions.nome}`} className="border-t border-borda align-top">
                  <td className="py-1 pr-3"><Link href={`/rodadas/${h.run_id}`} className="text-marca hover:underline">#{h.run_id}</Link>
                    <span className="block text-suave">{formatarData(h.runs.criado_em)}</span></td>
                  <td className="pr-3">{h.regions.nome}</td>
                  <td className="pr-3 text-right tabular-nums">{Math.round(Number(h.presenca) * 100)}% <span className="text-suave">({h.aparicoes}/{h.buscas})</span></td>
                  <td className="pr-3">{rotuloForca(h.forca, h.buscas)}</td>
                  <td className="pr-3 text-right">{h.pos_media ? Number(h.pos_media).toFixed(1) : "—"}</td>
                  <td className="max-w-[200px] pr-3 text-suave">{h.pontos.join(", ")}</td>
                  <td className="max-w-[220px]">{h.titulo}{h.link && <a href={h.link} target="_blank" rel="noreferrer" className="block text-marca hover:underline">abrir</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(eventos.data ?? []).length > 0 && (
        <section className="cartao p-4 text-sm">
          <h2 className="mb-2 font-semibold">Histórico</h2>
          <ul className="space-y-1 text-xs">
            {(eventos.data ?? []).map((e, i) => (
              <li key={i}><span className="text-suave">{formatarData(e.criado_em)}</span> · {e.tipo === "status" ? "Status: " : "Nota: "}{e.texto}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
