"use client";

import { useMemo, useState, useTransition } from "react";
import { iniciarPesquisa } from "./actions";
import { AdicionarCidade } from "./adicionar-cidade";

type Nicho = { nome: string; modelos: string[] };
type Regiao = { id: number; nome: string; uf: string; ddd: string };
type Local = { id: number; region_id: number; nome_exibicao: string; camada: string };
export type Dados = { nichos: Nicho[]; regioes: Regiao[]; locais: Local[]; creditos: number };
export type Inicial = { rodada: number; termos: string[]; locationIds: number[] };

/** Pré-preenche o formulário com uma rodada anterior ("Ajustar e repetir"). */
function estadoInicial(dados: Dados, inicial?: Inicial | null) {
  if (!inicial?.termos.length) return null;
  const termo = inicial.termos[0];
  const nicho = nichoDoTermo(termo, dados.nichos);
  const sug = [...new Set((nicho?.modelos ?? GENERICO).map((m) => m.replaceAll("{termo}", termo)))];
  const escolhidos = new Set(inicial.termos);
  const ids = new Set(inicial.locationIds);
  const regioes = new Set(dados.locais.filter((l) => ids.has(l.id)).map((l) => l.region_id));
  return {
    termo,
    marcadas: new Set(sug.filter((s) => escolhidos.has(s))),
    desmarcadas: new Set(sug.filter((s) => !escolhidos.has(s))),
    extras: inicial.termos.filter((t) => !sug.includes(t)),
    regioes,
    uf: dados.regioes.find((r) => regioes.has(r.id))?.uf ?? "",
    pontosFora: new Set(dados.locais.filter((l) => regioes.has(l.region_id) && !ids.has(l.id)).map((l) => l.id)),
  };
}

const CAMADAS = [
  { v: "minima", rotulo: "Mínima", dica: "capital / polo" },
  { v: "media", rotulo: "Média", dica: "+ cidades grandes" },
  { v: "ampla", rotulo: "Ampla", dica: "tudo da região" },
] as const;
const INCLUI: Record<string, string[]> = { minima: ["minima"], media: ["minima", "media"], ampla: ["minima", "media", "ampla"] };
const GENERICO = ["{termo}", "{termo} 24 horas", "{termo} perto de mim", "{termo} emergência"];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function nichoDoTermo(termo: string, nichos: Nicho[]): Nicho | null {
  const t = norm(termo);
  if (!t) return null;
  return nichos.find((n) => t.includes(norm(n.nome)) || (t.split(" ")[0].length >= 4 && norm(n.nome).includes(t.split(" ")[0]))) ?? null;
}

export function FormPesquisa({ dados, inicial }: { dados: Dados; inicial?: Inicial | null }) {
  const [ini] = useState(() => estadoInicial(dados, inicial));
  const [termo, setTermo] = useState(ini?.termo ?? "");
  const [nichoEscolhido, setNichoEscolhido] = useState<string>("auto");
  const [marcadas, setMarcadas] = useState<Set<string>>(ini?.marcadas ?? new Set());
  const [desmarcadas, setDesmarcadas] = useState<Set<string>>(ini?.desmarcadas ?? new Set());
  const [extras, setExtras] = useState<string[]>(ini?.extras ?? []);
  const [novaExtra, setNovaExtra] = useState("");
  const [uf, setUf] = useState(ini?.uf ?? "");
  const [regioesSel, setRegioesSel] = useState<Set<number>>(ini?.regioes ?? new Set());
  // repetindo: mostra "Ampla" com os pontos que não estavam na rodada já riscados
  const [camada, setCamada] = useState<"minima" | "media" | "ampla">(ini ? "ampla" : "media");
  const [pontosFora, setPontosFora] = useState<Set<number>>(ini?.pontosFora ?? new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  // --- Variações ---
  const nicho = nichoEscolhido === "auto" ? nichoDoTermo(termo, dados.nichos)
    : dados.nichos.find((n) => n.nome === nichoEscolhido) ?? null;
  const sugestoes = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return [];
    const modelos = nicho?.modelos ?? GENERICO;
    return [...new Set(modelos.map((m) => m.replaceAll("{termo}", t)))];
  }, [termo, nicho]);
  // Por padrão: o próprio termo e a 2ª sugestão vêm marcados
  const estaMarcada = (s: string, i: number) =>
    marcadas.has(s) || (!desmarcadas.has(s) && i < 2);
  const alternarVariacao = (s: string, i: number) => {
    const ligada = estaMarcada(s, i);
    setMarcadas((m) => { const n = new Set(m); if (ligada) n.delete(s); else n.add(s); return n; });
    setDesmarcadas((d) => { const n = new Set(d); if (ligada) n.add(s); else n.delete(s); return n; });
  };
  const termosFinais = [...new Set([...sugestoes.filter(estaMarcada), ...extras])];

  // --- Área ---
  const ufs = useMemo(() => [...new Set(dados.regioes.map((r) => r.uf))].sort(), [dados.regioes]);
  const regioesUf = dados.regioes.filter((r) => r.uf === uf);
  // cidades adicionadas na hora entram sempre, em qualquer tamanho
  const [locaisExtras, setLocaisExtras] = useState<Local[]>([]);
  const [sempre, setSempre] = useState<Set<number>>(new Set());
  const todosLocais = [...dados.locais, ...locaisExtras.filter((x) => !dados.locais.some((l) => l.id === x.id))];
  const pontosCandidatos = todosLocais.filter((l) => regioesSel.has(l.region_id) && (INCLUI[camada].includes(l.camada) || sempre.has(l.id)));
  const pontosFinais = pontosCandidatos.filter((l) => !pontosFora.has(l.id));

  // Trocar de estado só muda a lista mostrada: as regiões já escolhidas (de qualquer estado) continuam
  const escolherUf = (novo: string) => setUf(novo);
  const selPorUf = (u: string) => dados.regioes.filter((r) => r.uf === u && regioesSel.has(r.id)).length;
  const regioesEscolhidas = dados.regioes.filter((r) => regioesSel.has(r.id));
  const alternarRegiao = (id: number) =>
    setRegioesSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const alternarPonto = (id: number) =>
    setPontosFora((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const total = termosFinais.length * pontosFinais.length;
  const falta = total > dados.creditos;

  function pesquisar() {
    setErro(null);
    iniciar(async () => {
      const r = await iniciarPesquisa(termosFinais, pontosFinais.map((p) => p.id));
      if (r?.erro) setErro(r.erro);
    });
  }

  return (
    <div className="space-y-6">
      {inicial && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Preenchido com a rodada #{inicial.rodada}: {inicial.termos.length} variações e {inicial.locationIds.length} pontos.
          Ajuste o que quiser e clique em Pesquisar.
        </p>
      )}
      {/* 1. Palavra-chave */}
      <div>
        <input
          value={termo}
          onChange={(e) => { setTermo(e.target.value); setMarcadas(new Set()); setDesmarcadas(new Set()); }}
          placeholder="ex.: desentupidora"
          autoFocus
          className="w-full rounded-full border border-borda bg-white px-6 py-4 text-base shadow-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
        />
      </div>

      {sugestoes.length > 0 && (
        <section className="cartao space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Variações</h2>
            <select value={nichoEscolhido} onChange={(e) => setNichoEscolhido(e.target.value)} className="campo py-1 text-xs">
              <option value="auto">Modelo: {nicho ? `${nicho.nome} (automático)` : "genérico (automático)"}</option>
              {dados.nichos.map((n) => <option key={n.nome} value={n.nome}>Modelo: {n.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((s, i) => (
              <button key={s} type="button" onClick={() => alternarVariacao(s, i)}
                className={`rounded-full border px-3 py-1.5 text-sm ${estaMarcada(s, i)
                  ? "border-marca bg-marca text-white" : "border-borda bg-white text-texto hover:bg-slate-50"}`}>
                {s}
              </button>
            ))}
            {extras.map((s) => (
              <button key={s} type="button" onClick={() => setExtras((x) => x.filter((y) => y !== s))}
                className="rounded-full border border-marca bg-marca px-3 py-1.5 text-sm text-white" title="Remover">
                {s} ×
              </button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            const v = novaExtra.trim().toLowerCase();
            if (v && !termosFinais.includes(v)) setExtras((x) => [...x, v]);
            setNovaExtra("");
          }}>
            <input value={novaExtra} onChange={(e) => setNovaExtra(e.target.value)} placeholder="Outra variação…"
              className="campo flex-1 py-1.5" />
            <button className="botao-sec py-1.5">Adicionar</button>
          </form>
        </section>
      )}

      {/* 2. Área */}
      {sugestoes.length > 0 && (
        <section className="cartao space-y-4 p-4">
          <h2 className="text-sm font-semibold">Área</h2>
          <select value={uf} onChange={(e) => escolherUf(e.target.value)} className="campo w-full sm:w-64">
            <option value="">{regioesSel.size ? "Adicionar região de outro estado…" : "Escolha o estado…"}</option>
            {ufs.map((u) => <option key={u} value={u}>{u}{selPorUf(u) ? ` (${selPorUf(u)} escolhida${selPorUf(u) > 1 ? "s" : ""})` : ""}</option>)}
          </select>

          {uf && (
            <div className="flex flex-wrap gap-2">
              {regioesUf.map((r) => (
                <button key={r.id} type="button" onClick={() => alternarRegiao(r.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${regioesSel.has(r.id)
                    ? "border-marca bg-blue-50 text-marca" : "border-borda bg-white hover:bg-slate-50"}`}>
                  {regioesSel.has(r.id) ? "✓ " : "+ "}{r.nome}
                </button>
              ))}
            </div>
          )}

          {regioesEscolhidas.length > 0 && (
            <>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="mb-1 text-xs text-suave">
                  Regiões escolhidas ({regioesEscolhidas.length}) — troque o estado acima para adicionar de outros estados:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {regioesEscolhidas.map((r) => (
                    <span key={r.id} className="selo gap-1 bg-marca py-1 text-white">
                      {r.uf} · {r.nome}
                      <button type="button" onClick={() => alternarRegiao(r.id)} aria-label={`Tirar ${r.nome}`} className="opacity-70 hover:opacity-100">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {CAMADAS.map((c) => (
                  <button key={c.v} type="button" onClick={() => { setCamada(c.v); setPontosFora(new Set()); }}
                    className={`rounded-lg border px-2 py-2 text-left text-sm ${camada === c.v
                      ? "border-marca bg-blue-50" : "border-borda bg-white hover:bg-slate-50"}`}>
                    <span className="block font-medium">{c.rotulo}</span>
                    <span className="block text-xs text-suave">{c.dica}</span>
                  </button>
                ))}
              </div>

              {pontosCandidatos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-suave">Pontos (clique para tirar ou pôr de volta):</p>
                  {[...regioesSel].map((rid) => {
                    const ps = pontosCandidatos.filter((p) => p.region_id === rid);
                    if (!ps.length) return null;
                    return (
                      <div key={rid}>
                        {regioesSel.size > 1 && (
                          <p className="mb-1 text-xs font-medium">
                            {(() => { const r = dados.regioes.find((x) => x.id === rid); return r ? `${r.uf} · ${r.nome}` : ""; })()}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {ps.map((p) => (
                            <button key={p.id} type="button" onClick={() => alternarPonto(p.id)}
                              className={`rounded-md border px-2 py-1 text-xs ${pontosFora.has(p.id)
                                ? "border-borda bg-white text-suave line-through" : "border-slate-300 bg-slate-100"}`}>
                              {p.nome_exibicao}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {uf && (
            <AdicionarCidade
              uf={uf}
              regioes={regioesUf}
              regiaoPadrao={regioesUf.find((r) => regioesSel.has(r.id))?.id ?? null}
              onAdicionada={(l) => {
                setLocaisExtras((x) => (x.some((y) => y.id === l.id) ? x : [...x, l]));
                setSempre((x) => new Set(x).add(l.id));
                setRegioesSel((x) => new Set(x).add(l.region_id));
                setPontosFora((x) => { const n = new Set(x); n.delete(l.id); return n; });
              }}
            />
          )}
        </section>
      )}

      {/* 3. Plano e custo */}
      {sugestoes.length > 0 && (
        <section className="cartao flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p>
              <strong>{termosFinais.length}</strong> variaç{termosFinais.length === 1 ? "ão" : "ões"} ×{" "}
              <strong>{pontosFinais.length}</strong> ponto{pontosFinais.length === 1 ? "" : "s"} ={" "}
              <strong className="text-base">{total}</strong> buscas
            </p>
            <p className={falta ? "text-red-600" : "text-suave"}>
              Créditos disponíveis: {dados.creditos}
              {falta && " — não dá. Adicione uma chave ou reduza o plano."}
            </p>
          </div>
          <button onClick={pesquisar} disabled={!total || falta || enviando} className="botao px-6 py-3 text-base">
            {enviando ? "Preparando…" : "Pesquisar"}
          </button>
        </section>
      )}
      {erro && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
    </div>
  );
}
