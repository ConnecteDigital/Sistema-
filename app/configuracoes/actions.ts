"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { criptografar, descriptografar } from "@/lib/crypto";
import { buscarLocais, consultarConta } from "@/lib/serpapi";

export type Resultado = { ok: boolean; msg: string } | null;

async function atualizarCreditos(id: number, chaveCifrada: string) {
  try {
    const c = await consultarConta(descriptografar(chaveCifrada));
    await db().from("serp_keys").update({
      creditos_restantes: c.creditosRestantes, buscas_por_mes: c.buscasPorMes, uso_mes: c.usoMes,
      limite_por_hora: c.limitePorHora, plano: c.plano, erro: null, verificada_em: new Date().toISOString(),
    }).eq("id", id);
    return null;
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await db().from("serp_keys").update({ erro, verificada_em: new Date().toISOString() }).eq("id", id);
    return erro;
  }
}

export async function adicionarChave(_: Resultado, form: FormData): Promise<Resultado> {
  const apelido = String(form.get("apelido") ?? "").trim();
  const chave = String(form.get("chave") ?? "").trim();
  if (!apelido || !chave) return { ok: false, msg: "Preencha o apelido e a chave." };
  if (!/^[A-Za-z0-9]{20,}$/.test(chave)) return { ok: false, msg: "Isso não parece uma chave da SerpApi." };

  // Testa a chave antes de salvar (grátis)
  let conta;
  try { conta = await consultarConta(chave); }
  catch (e) { return { ok: false, msg: "A SerpApi recusou a chave: " + (e instanceof Error ? e.message : e) }; }

  const { error } = await db().from("serp_keys").insert({
    apelido, chave_criptografada: criptografar(chave), chave_final: chave.slice(-4),
    creditos_restantes: conta.creditosRestantes, buscas_por_mes: conta.buscasPorMes, uso_mes: conta.usoMes,
    limite_por_hora: conta.limitePorHora, plano: conta.plano, verificada_em: new Date().toISOString(),
  });
  if (error) return { ok: false, msg: "Erro ao salvar: " + error.message };
  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: true, msg: `Chave "${apelido}" salva: ${conta.creditosRestantes ?? "?"} créditos.` };
}

export async function atualizarTodosCreditos(): Promise<void> {
  const { data } = await db().from("serp_keys").select("id, chave_criptografada").eq("ativa", true);
  await Promise.all((data ?? []).map((k) => atualizarCreditos(k.id, k.chave_criptografada)));
  revalidatePath("/configuracoes");
  revalidatePath("/");
}

export async function alternarChave(form: FormData): Promise<void> {
  const id = Number(form.get("id"));
  const ativa = form.get("ativa") === "true";
  await db().from("serp_keys").update({ ativa: !ativa }).eq("id", id);
  revalidatePath("/configuracoes");
}

export async function excluirChave(form: FormData): Promise<void> {
  await db().from("serp_keys").delete().eq("id", Number(form.get("id")));
  revalidatePath("/configuracoes");
  revalidatePath("/");
}

export async function salvarLimiteTroca(form: FormData): Promise<void> {
  const id = Number(form.get("id"));
  const limite = Math.max(0, Math.min(50, Number(form.get("limite_troca")) || 0));
  await db().from("serp_keys").update({ limite_troca: limite }).eq("id", id);
  revalidatePath("/configuracoes");
}

export async function adicionarPessoa(form: FormData): Promise<void> {
  const nome = String(form.get("nome") ?? "").trim();
  if (nome) await db().from("equipe").upsert({ nome, ativo: true }, { onConflict: "nome" });
  revalidatePath("/configuracoes");
}

export async function removerPessoa(form: FormData): Promise<void> {
  // Não apaga (leads podem apontar para a pessoa): só desativa
  await db().from("equipe").update({ ativo: false }).eq("id", Number(form.get("id")));
  revalidatePath("/configuracoes");
}

/** Confere no locations.json (grátis) os pontos ainda não validados. */
export async function validarLocais(_: Resultado): Promise<Resultado> {
  const { data, error } = await db().from("locations")
    .select("id, nome_exibicao, serpapi_canonical").is("validado_em", null).eq("ativo", true);
  if (error) return { ok: false, msg: error.message };
  if (!data?.length) return { ok: true, msg: "Todos os pontos já estão validados." };

  const invalidos: string[] = [];
  let validos = 0;
  const fila = [...data];
  async function trabalhador() {
    for (let l = fila.shift(); l; l = fila.shift()) {
      try {
        const nome = l.serpapi_canonical.split(",")[0];
        const achados = await buscarLocais(nome, 20);
        if (achados.some((a) => a.canonical_name === l.serpapi_canonical)) {
          await db().from("locations").update({ validado_em: new Date().toISOString() }).eq("id", l.id);
          validos++;
        } else {
          const sugestao = achados.find((a) => a.canonical_name.startsWith(nome))?.canonical_name;
          invalidos.push(`${l.nome_exibicao}${sugestao ? ` (SerpApi sugere: ${sugestao})` : " (não existe no catálogo)"}`);
        }
      } catch (e) {
        invalidos.push(`${l.nome_exibicao} (erro: ${e instanceof Error ? e.message : e})`);
      }
    }
  }
  await Promise.all(Array.from({ length: 5 }, trabalhador));
  revalidatePath("/configuracoes");
  return {
    ok: invalidos.length === 0,
    msg: `${validos} validados.` + (invalidos.length ? ` Com problema: ${invalidos.join("; ")}` : ""),
  };
}
