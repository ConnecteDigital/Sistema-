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

/**
 * Confere no locations.json (grátis) os pontos ainda não validados, em lotes de 60 por clique.
 * Se o nome exato não existir mas houver um equivalente no mesmo estado
 * (ex.: "Osasco,Osasco,State of Sao Paulo,Brazil"), corrige sozinho.
 */
export async function validarLocais(_: Resultado): Promise<Resultado> {
  const LOTE = 60;
  const { data, error, count } = await db().from("locations")
    .select("id, nome_exibicao, serpapi_canonical", { count: "exact" })
    .is("validado_em", null).eq("ativo", true).order("id").limit(LOTE);
  if (error) return { ok: false, msg: error.message };
  if (!data?.length) return { ok: true, msg: "Todos os pontos já estão validados." };

  const problemas: string[] = [];
  let validos = 0, corrigidos = 0;
  const fila = [...data];
  async function trabalhador() {
    for (let l = fila.shift(); l; l = fila.shift()) {
      try {
        const partes = l.serpapi_canonical.split(",");
        const cidade = partes[0];
        const estado = "," + partes.slice(-2).join(",");          // ",State of X,Brazil"
        const achados = await buscarLocais(cidade, 20);
        const agora = new Date().toISOString();
        if (achados.some((a) => a.canonical_name === l.serpapi_canonical)) {
          await db().from("locations").update({ validado_em: agora }).eq("id", l.id);
          validos++;
          continue;
        }
        const equivalentes = achados.filter((a) =>
          a.canonical_name.startsWith(cidade + ",") && a.canonical_name.endsWith(estado));
        const escolhido = equivalentes.find((a) => a.target_type === "City") ?? equivalentes[0];
        if (escolhido) {
          const { error: e } = await db().from("locations")
            .update({ serpapi_canonical: escolhido.canonical_name, validado_em: agora }).eq("id", l.id);
          if (e) problemas.push(`${l.nome_exibicao} (erro ao corrigir: ${e.message})`);
          else corrigidos++;
        } else {
          // Não existe no catálogo: desativa para não gastar crédito com local errado
          await db().from("locations").update({ ativo: false }).eq("id", l.id);
          problemas.push(`${l.nome_exibicao} (não existe na SerpApi — desativado)`);
        }
      } catch (e) {
        problemas.push(`${l.nome_exibicao} (erro: ${e instanceof Error ? e.message : e})`);
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, trabalhador));
  revalidatePath("/configuracoes");
  const faltam = Math.max(0, (count ?? 0) - data.length);
  return {
    ok: problemas.length === 0,
    msg: `${validos} validados` + (corrigidos ? `, ${corrigidos} corrigidos automaticamente` : "") + "." +
      (problemas.length ? ` Com problema: ${problemas.join("; ")}.` : "") +
      (faltam ? ` Faltam ${faltam}: clique de novo.` : ""),
  };
}
