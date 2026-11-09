"use client";

import { useState, useTransition } from "react";
import { adicionarCidade, buscarCidades, type CidadeEncontrada } from "./actions";

type Local = { id: number; region_id: number; nome_exibicao: string; camada: string };

/** Caixa "Adicionar cidade": procura no catálogo da SerpApi (grátis) e salva na região escolhida. */
export function AdicionarCidade({ uf, regioes, regiaoPadrao, onAdicionada }: {
  uf: string; regioes: { id: number; nome: string }[]; regiaoPadrao: number | null; onAdicionada: (l: Local) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [regiao, setRegiao] = useState<number | null>(regiaoPadrao ?? regioes[0]?.id ?? null);
  const [achadas, setAchadas] = useState<CidadeEncontrada[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (!aberto) {
    return (
      <button type="button" onClick={() => { setRegiao(regiaoPadrao ?? regioes[0]?.id ?? null); setAberto(true); }} className="text-sm text-marca hover:underline">
        + Adicionar cidade ou bairro que não está na lista
      </button>
    );
  }
  const buscar = () => iniciar(async () => {
    setMsg(null);
    const r = await buscarCidades(texto, uf);
    setAchadas(r.cidades);
    if (r.erro) setMsg({ ok: false, t: r.erro });
  });
  const adicionar = (c: CidadeEncontrada) => iniciar(async () => {
    if (!regiao) { setMsg({ ok: false, t: "Escolha a região." }); return; }
    const r = await adicionarCidade(c.canonical, c.nome, c.tipo, regiao);
    if ("erro" in r && r.erro) { setMsg({ ok: false, t: r.erro }); return; }
    if ("local" in r && r.local) {
      onAdicionada(r.local as Local);
      setMsg({ ok: true, t: `${c.nome} entrou nesta pesquisa e ficou salva na região.` });
      setAchadas(null); setTexto("");
    }
  });

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-borda p-3">
      <p className="text-xs text-suave">Adicionar cidade ou bairro de <strong>{uf}</strong> (procura no catálogo da SerpApi, não gasta crédito):</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ex.: Itapecerica da Serra"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} className="campo flex-1 py-1.5" />
        <select value={regiao ?? ""} onChange={(e) => setRegiao(Number(e.target.value))} className="campo py-1.5" title="Região onde a cidade fica salva">
          {regioes.map((r) => <option key={r.id} value={r.id}>salvar em: {r.nome}</option>)}
        </select>
        <button type="button" onClick={buscar} disabled={ocupado || texto.trim().length < 3} className="botao-sec py-1.5">
          {ocupado ? "…" : "Procurar"}
        </button>
      </div>
      {achadas && achadas.length > 0 && (
        <div className="space-y-1">
          {achadas.map((c) => (
            <div key={c.canonical} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1 text-sm">
              <span>{c.nome} <span className="text-[11px] text-suave">· {c.tipo === "City" || c.tipo === "Municipality" ? "cidade" : "bairro/distrito"} · {c.canonical}</span></span>
              <button type="button" onClick={() => adicionar(c)} disabled={ocupado} className="botao py-1 text-xs">
                {c.jaExiste ? "Usar" : "Adicionar"}
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.t}</p>}
    </div>
  );
}
