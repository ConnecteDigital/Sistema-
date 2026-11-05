import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { BASE_BUSCA_NOME, buscarTarefa, dataForSeoConfigurado, postarBuscaNome, postarContas, postarDominio, type ItemAds } from "@/lib/dataforseo";
import { resumirContas, resumirParecidas } from "@/lib/contas-ads";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const erro = (msg: string, status = 500) => NextResponse.json({ erro: msg }, { status });

async function anunciante(id: number) {
  const { data } = await db().from("advertisers").select("id, dominio").eq("id", id).maybeSingle();
  return data;
}

/** Inicia a consulta da conta do Google Ads do anunciante (custa centavos na DataForSEO). */
export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!dataForSeoConfigurado()) return erro("Cadastre DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD nas variáveis da Vercel.", 400);
  const id = Number((await ctx.params).id);
  const adv = await anunciante(id);
  if (!adv) return erro("Anunciante não encontrado", 404);
  if (adv.dominio.startsWith("perfil-google:")) return erro("Esse anúncio não tem site: procure o nome na Central de Transparência.", 400);
  try {
    const task = await postarDominio(adv.dominio);
    const { error } = await db().from("contas_google_ads").upsert({
      advertiser_id: id, task_dominio: task, task_conta: null, status: "pendente", resultado: null, bruto: null, erro: null,
      consultado_em: new Date().toISOString(),
    }, { onConflict: "advertiser_id" });
    if (error) return erro(error.message + " — rodou o 0008_conta_google_ads.sql?");
    return NextResponse.json({ status: "pendente" });
  } catch (e) {
    return erro(e instanceof Error ? e.message : String(e));
  }
}

/** Acompanha a consulta: chama de novo até status = pronta. */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const { data: row, error } = await db().from("contas_google_ads").select("*").eq("advertiser_id", id).maybeSingle();
  if (error) return erro(error.message);
  if (!row) return NextResponse.json({ status: "nenhuma" });
  if (row.status !== "pendente") return NextResponse.json({ ...row, bruto: undefined, diag: row.bruto?.diag ?? null });
  if (!dataForSeoConfigurado()) return erro("DataForSEO não configurada.", 400);

  const adv = await anunciante(id);
  const salvar = (campos: Record<string, unknown>) => db().from("contas_google_ads").update(campos).eq("advertiser_id", id);
  try {
    const bruto = (row.bruto ?? {}) as { etapa1?: ItemAds[]; diag?: Record<string, unknown> };
    const diag = bruto.diag ?? {};
    if (!row.task_conta) {
      // Etapa 1: anúncios do domínio
      const r = await buscarTarefa(row.task_dominio);
      if (r.itens === null) return NextResponse.json({ status: "pendente", etapa: 1 });
      diag.dominio = r.bruto;
      const resumo = resumirContas(r.itens, adv!.dominio);
      const ids = resumo.contas.map((c) => c.advertiserId);
      if (ids.length) {
        // Etapa 2: tudo que essas contas anunciam (outros sites do mesmo dono)
        const task = await postarContas(ids);
        await salvar({ task_conta: task, resultado: resumo, bruto: { etapa1: r.itens, diag } });
        return NextResponse.json({ status: "pendente", etapa: 2, resultado: resumo });
      }
      // Nada pelo domínio → plano B: procurar pelo nome, como a caixa de busca da Transparência
      const palavra = adv!.dominio.replace(/\.(com|net|org|ind|eng|eco|app|tec|srv|adv|art|blog|emp|bsb)?\.?br$|\.com$|\.net$/, "");
      const task = await postarBuscaNome(palavra);
      await salvar({ task_conta: "nome:" + task, resultado: { ...resumo, buscaNome: palavra }, bruto: { etapa1: [], diag } });
      return NextResponse.json({ status: "pendente", etapa: 2, resultado: resumo });
    }
    if (row.task_conta.startsWith("nome:")) {
      const r = await buscarTarefa(row.task_conta.slice(5), BASE_BUSCA_NOME);
      if (r.itens === null) return NextResponse.json({ status: "pendente", etapa: 2, resultado: row.resultado });
      diag.busca_nome = r.bruto;
      await salvar({ status: "pronta", resultado: { ...(row.resultado ?? {}), contas: [], outrosSites: [], parecidas: resumirParecidas(r.itens) },
        bruto: { ...bruto, diag } });
    } else {
      const r = await buscarTarefa(row.task_conta);
      if (r.itens === null) return NextResponse.json({ status: "pendente", etapa: 2, resultado: row.resultado });
      diag.contas = r.bruto;
      const todos = [...(bruto.etapa1 ?? []), ...r.itens];
      await salvar({ status: "pronta", resultado: resumirContas(todos, adv!.dominio), bruto: { etapa1: bruto.etapa1 ?? [], diag } });
    }
  } catch (e) {
    await salvar({ status: "erro", erro: e instanceof Error ? e.message : String(e) });
  }
  const { data: final } = await db().from("contas_google_ads").select("*").eq("advertiser_id", id).maybeSingle();
  return NextResponse.json({ ...final, bruto: undefined, diag: final?.bruto?.diag ?? null });
}
