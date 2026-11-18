"use client";

import { useState } from "react";

/** Lista suspensa com caixinhas (várias escolhas). Envia no formulário como name=valor repetido. */
export function FiltroMulti({ nome, rotulo, todos, opcoes, marcados }: {
  nome: string; rotulo: string; todos: string; opcoes: { valor: string; texto: string }[]; marcados: string[];
}) {
  const [sel, setSel] = useState<string[]>(marcados);
  const resumo = !sel.length ? todos : sel.length === 1 ? (opcoes.find((o) => o.valor === sel[0])?.texto ?? sel[0]) : `${rotulo}: ${sel.length}`;
  return (
    <details className="relative">
      <summary className="campo cursor-pointer list-none select-none whitespace-nowrap pr-7">
        {resumo.length > 40 ? resumo.slice(0, 40) + "…" : resumo}<span className="absolute right-2 text-suave">▾</span>
      </summary>
      <div className="absolute z-20 mt-1 w-80 space-y-1 rounded-lg border border-borda bg-white p-2 text-sm shadow-lg">
        <div className="flex gap-3 border-b border-borda pb-1 text-xs">
          <button type="button" className="text-marca hover:underline" onClick={() => setSel(opcoes.map((o) => o.valor))}>marcar todas</button>
          <button type="button" className="text-marca hover:underline" onClick={() => setSel([])}>limpar</button>
        </div>
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {opcoes.map((o) => (
            <label key={o.valor} className="flex items-start gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
              <input type="checkbox" className="mt-1" name={nome} value={o.valor} checked={sel.includes(o.valor)}
                onChange={() => setSel((x) => x.includes(o.valor) ? x.filter((y) => y !== o.valor) : [...x, o.valor])} />
              <span className="text-xs">{o.texto}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
