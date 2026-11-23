"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Escolhe uma ou várias rodadas (várias = relatório unificado, sem repetir anunciante). */
export function SeletorRodadas({ atuais, rodadas }: { atuais: number[]; rodadas: { id: number; rotulo: string }[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState<number[]>(atuais);
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase().replace(/^#/, "");
  const visiveis = termo ? rodadas.filter((r) => r.rotulo.toLowerCase().includes(termo) || String(r.id) === termo) : rodadas;
  const ver = (ids: number[]) => router.push(ids.length > 1 ? `/relatorios?rodadas=${[...ids].sort((a, b) => a - b).join(",")}` : `/relatorios?rodada=${ids[0]}`);
  const atual = rodadas.filter((r) => atuais.includes(r.id)).sort((a, b) => a.id - b.id);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {atuais.length === 1 ? (
          <select value={atuais[0]} onChange={(e) => ver([Number(e.target.value)])} className="campo w-full sm:w-[420px]">
            {rodadas.map((r) => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
          </select>
        ) : (
          <p className="text-sm font-medium">{atual.map((r) => `#${r.id}`).join(" + ")} (unificadas)</p>
        )}
        <button onClick={() => setAberto((a) => !a)} className="botao-sec py-1.5 text-xs">
          {aberto ? "Fechar" : "Juntar rodadas"}
        </button>
      </div>
      {aberto && (
        <div className="cartao max-w-xl space-y-2 p-3 text-sm">
          <p className="text-xs text-suave">Marque as rodadas para ver tudo junto, sem repetir anunciante, e comparar os horários ({rodadas.length} rodadas):</p>
          <div className="flex gap-2">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: número, data ou palavra (ex.: 12, 15/11, encanador)"
              className="campo w-full py-1 text-xs" />
            {sel.length > 0 && <button type="button" onClick={() => setSel([])} className="whitespace-nowrap text-xs text-marca hover:underline">limpar ({sel.length})</button>}
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {!visiveis.length && <p className="text-xs text-suave">Nenhuma rodada com esse texto.</p>}
            {visiveis.map((r) => (
              <label key={r.id} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={sel.includes(r.id)}
                  onChange={() => setSel((x) => x.includes(r.id) ? x.filter((y) => y !== r.id) : [...x, r.id])} />
                <span className="text-xs">{r.rotulo}</span>
              </label>
            ))}
          </div>
          <button disabled={!sel.length} onClick={() => ver(sel)} className="botao w-full">
            Ver relatório {sel.length > 1 ? `de ${sel.length} rodadas juntas` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
