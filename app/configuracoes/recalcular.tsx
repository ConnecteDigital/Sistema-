"use client";

import { useState } from "react";
import { recalcularPrioridadesAcao } from "./actions";

/** Refaz as prioridades de todas as rodadas, várias de cada vez, até acabar (a tela mostra o andamento). */
export function BotaoRecalcularPrioridades({ total }: { total: number }) {
  const [rodando, setRodando] = useState(false);
  const [faltam, setFaltam] = useState(total);
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  async function rodar() {
    setRodando(true); setMsg(null);
    let resto = total;
    for (let i = 0; i < 400 && resto > 0; i++) {
      const r = await recalcularPrioridadesAcao();
      if (!r.ok) { setMsg(r); break; }
      resto = r.faltam; setFaltam(resto);
      if (!resto) setMsg({ ok: true, msg: "Pronto: todos os leads com a prioridade nova." });
    }
    setRodando(false);
  }
  return (
    <div className="space-y-2">
      <button onClick={rodar} disabled={rodando} className="botao-sec">
        {rodando ? `Recalculando… faltam ${faltam} rodada(s)` : "Recalcular prioridades dos leads"}
      </button>
      {rodando && <p className="text-xs text-suave">Pode deixar a página aberta; não feche até terminar.</p>}
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.msg}</p>}
    </div>
  );
}
