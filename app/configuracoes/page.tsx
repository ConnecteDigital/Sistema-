import { db } from "@/lib/supabase";
import { variaveisFaltando } from "@/lib/env";
import { formatarData } from "@/lib/utils";
import { AvisoConfiguracao } from "@/components/aviso-configuracao";
import { BotaoEnviar, BotaoValidarLocais, FormNovaChave } from "./formularios";
import {
  adicionarNicho, adicionarPessoa, adicionarVariacao, alternarChave, removerVariacao, atualizarTodosCreditos, excluirChave, removerPessoa, salvarLimiteTroca,
} from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Configurações" };

type Chave = {
  id: number; apelido: string; chave_final: string; ativa: boolean; limite_troca: number;
  creditos_restantes: number | null; buscas_por_mes: number | null; uso_mes: number | null;
  limite_por_hora: number | null; plano: string | null; erro: string | null; verificada_em: string | null;
};

export default async function Configuracoes() {
  if (variaveisFaltando().length) {
    return <main className="mx-auto max-w-4xl p-4"><AvisoConfiguracao /></main>;
  }
  const [chaves, equipe, regioes, locais, nichos] = await Promise.all([
    db().from("serp_keys").select("*").order("id"),
    db().from("equipe").select("id, nome").eq("ativo", true).order("nome"),
    db().from("regions").select("id, nome, ddd, uf").order("uf").order("ordem"),
    db().from("locations").select("region_id, camada, validado_em").eq("ativo", true),
    db().from("niches").select("id, nome, keyword_templates(id, modelo, ordem)").order("ordem"),
  ]);
  const erroBanco = chaves.error ?? equipe.error ?? regioes.error;
  if (erroBanco) {
    return (
      <main className="mx-auto max-w-4xl p-4">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Não consegui ler o banco.</p>
          <p className="mt-1">{erroBanco.message}</p>
          <p className="mt-2">Se as tabelas ainda não existem, rode no Supabase (SQL Editor) os arquivos
            <code> supabase/migrations/0001_schema.sql</code> e <code>0002_seed.sql</code>.</p>
        </div>
      </main>
    );
  }

  const lista = (chaves.data ?? []) as Chave[];
  const ativas = lista.filter((k) => k.ativa);
  const total = ativas.reduce((s, k) => s + (k.creditos_restantes ?? 0), 0);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Configurações</h1>

      {/* Chaves SerpApi */}
      <section className="cartao space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Chaves da SerpApi</h2>
            <p className="text-sm text-suave">
              Créditos disponíveis (chaves ativas): <strong className="text-texto text-base">{total}</strong>
              {" "}· {ativas.length} de {lista.length} ativas
            </p>
          </div>
          <form action={atualizarTodosCreditos}><BotaoEnviar>Atualizar créditos</BotaoEnviar></form>
        </div>

        {lista.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase text-suave">
                <tr className="border-b border-borda">
                  <th className="py-2 pr-3">Apelido</th><th className="pr-3">Chave</th><th className="pr-3">Plano</th>
                  <th className="pr-3 text-right">Créditos</th><th className="pr-3 text-right">Uso no mês</th>
                  <th className="pr-3">Trocar com</th><th className="pr-3">Verificada</th><th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((k) => (
                  <tr key={k.id} className={`border-b border-borda last:border-0 ${k.ativa ? "" : "opacity-50"}`}>
                    <td className="py-2 pr-3 font-medium">{k.apelido}</td>
                    <td className="pr-3 font-mono text-suave">••••{k.chave_final}</td>
                    <td className="pr-3">{k.plano ?? "—"}</td>
                    <td className="pr-3 text-right font-semibold tabular-nums">
                      {k.erro ? <span className="text-red-600" title={k.erro}>erro</span> : (k.creditos_restantes ?? "—")}
                    </td>
                    <td className="pr-3 text-right tabular-nums text-suave">
                      {k.uso_mes ?? "—"}{k.buscas_por_mes ? ` / ${k.buscas_por_mes}` : ""}
                    </td>
                    <td className="pr-3">
                      <form action={salvarLimiteTroca} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={k.id} />
                        <input name="limite_troca" type="number" min={0} max={50} defaultValue={k.limite_troca}
                          className="campo w-16 py-1" />
                        <button className="text-xs text-marca hover:underline">ok</button>
                      </form>
                    </td>
                    <td className="pr-3 text-suave">{formatarData(k.verificada_em)}</td>
                    <td className="whitespace-nowrap text-right">
                      <form action={alternarChave} className="inline">
                        <input type="hidden" name="id" value={k.id} />
                        <input type="hidden" name="ativa" value={String(k.ativa)} />
                        <button className="text-xs text-marca hover:underline">{k.ativa ? "desativar" : "ativar"}</button>
                      </form>
                      <form action={excluirChave} className="ml-3 inline">
                        <input type="hidden" name="id" value={k.id} />
                        <button className="text-xs text-red-600 hover:underline">excluir</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <FormNovaChave />
        <p className="text-xs text-suave">
          &quot;Trocar com&quot;: quando a chave chegar nesse número de créditos, a rodada passa para a próxima.
          Várias contas grátis da mesma pessoa podem ser bloqueadas pela SerpApi. O plano Starter elimina esse risco.
        </p>
      </section>

      {/* Equipe */}
      <section className="cartao space-y-3 p-4 sm:p-5">
        <h2 className="font-semibold">Equipe</h2>
        <p className="text-sm text-suave">Nomes que aparecem em &quot;Responsável&quot; nos leads.</p>
        <div className="flex flex-wrap gap-2">
          {(equipe.data ?? []).map((p) => (
            <form key={p.id} action={removerPessoa} className="selo gap-2 bg-slate-100 py-1 text-sm text-texto">
              <input type="hidden" name="id" value={p.id} />
              {p.nome}
              <button className="text-suave hover:text-red-600" aria-label={`Remover ${p.nome}`}>×</button>
            </form>
          ))}
        </div>
        <form action={adicionarPessoa} className="flex gap-2">
          <input name="nome" placeholder="Nome" required className="campo w-full sm:w-64" />
          <BotaoEnviar>Adicionar</BotaoEnviar>
        </form>
      </section>

      {/* Catálogo */}
      <section className="cartao space-y-3 p-4 sm:p-5">
        <h2 className="font-semibold">Regiões e pontos</h2>
        <p className="text-sm text-suave">
          {(regioes.data ?? []).length} regiões em {new Set((regioes.data ?? []).map((r) => r.uf)).size} estados ·{" "}
          {(locais.data ?? []).length} pontos ativos. Mínima = capital/polo; Média = + cidades grandes; Ampla = tudo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs uppercase text-suave">
              <tr className="border-b border-borda">
                <th className="py-2 pr-3">UF</th><th className="pr-3">Região</th><th className="pr-3">DDD</th>
                <th className="pr-3 text-right">Mínima</th><th className="pr-3 text-right">Média</th>
                <th className="pr-3 text-right">Ampla</th><th className="text-right">Não validados</th>
              </tr>
            </thead>
            <tbody>
              {(regioes.data ?? []).map((r) => {
                const ls = (locais.data ?? []).filter((l) => l.region_id === r.id);
                const n = (c: string[]) => ls.filter((l) => c.includes(l.camada)).length;
                const pend = ls.filter((l) => !l.validado_em).length;
                return (
                  <tr key={r.id} className="border-b border-borda last:border-0">
                    <td className="py-2 pr-3 text-suave">{r.uf}</td>
                    <td className="pr-3 font-medium">{r.nome}</td>
                    <td className="pr-3">{r.ddd}</td>
                    <td className="pr-3 text-right tabular-nums">{n(["minima"])}</td>
                    <td className="pr-3 text-right tabular-nums">{n(["minima", "media"])}</td>
                    <td className="pr-3 text-right tabular-nums">{ls.length}</td>
                    <td className={`text-right tabular-nums ${pend ? "text-amber-700" : "text-suave"}`}>{pend || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <BotaoValidarLocais />
      </section>

      {/* Variações */}
      <section className="cartao space-y-3 p-4 sm:p-5">
        <h2 className="font-semibold">Variações por nicho</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(nichos.data ?? []).map((n) => (
            <div key={n.id} className="space-y-1.5">
              <p className="text-sm font-medium">{n.nome}</p>
              <div className="flex flex-wrap gap-1">
                {[...(n.keyword_templates as { id: number; modelo: string; ordem: number }[])]
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((t) => (
                    <form key={t.id} action={removerVariacao} className="selo gap-1 bg-blue-50 text-blue-800">
                      <input type="hidden" name="id" value={t.id} />
                      {t.modelo}
                      <button className="text-blue-400 hover:text-red-600" aria-label={`Remover ${t.modelo}`}>×</button>
                    </form>
                  ))}
              </div>
              <form action={adicionarVariacao} className="flex gap-1">
                <input type="hidden" name="niche_id" value={n.id} />
                <input name="modelo" placeholder="nova variação, ex.: {termo} barato" className="campo flex-1 py-1 text-xs" />
                <button className="botao-sec py-1 text-xs">+</button>
              </form>
            </div>
          ))}
        </div>
        <form action={adicionarNicho} className="flex gap-2 border-t border-borda pt-3">
          <input name="nome" placeholder="Novo nicho (ex.: Dedetização)" className="campo w-full sm:w-64" />
          <BotaoEnviar>Adicionar nicho</BotaoEnviar>
        </form>
        <p className="text-xs text-suave">
          <code>{"{termo}"}</code> é trocado pelo que você digita na pesquisa. Ex.: <code>{"{termo} 24 horas"}</code> → &quot;encanador 24 horas&quot;.
        </p>
      </section>
    </main>
  );
}
