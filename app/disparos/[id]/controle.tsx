"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mudarStatusCampanha } from "../actions";

type P = { status: string; total: number; porStatus: Record<string, number>; erro: string | null; limiteRestante: number };
const ROTULOS: [string, string][] = [
  ["pendente", "na fila"], ["enviado", "enviadas"], ["entregue", "entregues"], ["lido", "lidas"],
  ["respondido", "responderam"], ["falhou", "falharam"], ["ignorado", "ignoradas"],
];

export function ControleCampanha({ id, inicial }: { id: number; inicial: P }) {
  const router = useRouter();
  const [p, setP] = useState(inicial);
  const [falha, setFalha] = useState<string | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    if (p.status !== "enviando") return;
    (async () => {
      while (vivo.current) {
        try {
          const r = await fetch(`/api/campanhas/${id}/enviar`, { method: "POST" });
          const j = await r.json();
          if (!r.ok) throw new Error(j.erro ?? `HTTP ${r.status}`);
          setP(j); setFalha(null); router.refresh();
          if (j.status !== "enviando") break;
        } catch (e) { setFalha(e instanceof Error ? e.message : String(e)); }
        await new Promise((ok) => setTimeout(ok, 10_000));
      }
    })();
    return () => { vivo.current = false; };
  }, [p.status, id, router]);

  const status = async (s: "enviando" | "pausada" | "cancelada") => {
    if (s === "cancelada" && !confirm("Cancelar a campanha? Quem ainda não recebeu fica de fora.")) return;
    await mudarStatusCampanha(id, s);
    setP((x) => ({ ...x, status: s, erro: null }));
    router.refresh();
  };
  const feitos = p.total - (p.porStatus.pendente ?? 0) - (p.porStatus.enviando ?? 0);
  const pct = p.total ? Math.round((feitos / p.total) * 100) : 0;
  const resp = p.porStatus.respondido ?? 0;

  return (
    <div className="cartao space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {p.status === "enviando" ? "Enviando…" : p.status === "concluida" ? "Concluída" : p.status === "cancelada" ? "Cancelada" : "Pausada"}
          <span className="ml-2 text-sm text-suave">{feitos}/{p.total} · {pct}%</span>
        </span>
        <div className="flex gap-2">
          {p.status === "pausada" && <button className="botao" onClick={() => status("enviando")}>{feitos ? "Continuar" : "Começar a enviar"}</button>}
          {p.status === "enviando" && <button className="botao-sec" onClick={() => status("pausada")}>Pausar</button>}
          {(p.status === "pausada" || p.status === "enviando") && <button className="botao-sec text-red-600" onClick={() => status("cancelada")}>Cancelar</button>}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-green-600 transition-all" style={{ width: `${pct}%` }} /></div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {ROTULOS.map(([k, r]) => <span key={k}><strong className="tabular-nums">{p.porStatus[k] ?? 0}</strong> {r}</span>)}
        {resp > 0 && <span className="text-green-700">· taxa de resposta {Math.round((resp / Math.max(1, feitos)) * 100)}%</span>}
      </div>
      <p className="text-xs text-suave">Ainda dá para enviar hoje: {p.limiteRestante} contatos novos. Deixe esta aba aberta enquanto envia.</p>
      {(p.erro || falha) && <p className="text-sm text-red-600">{p.erro ?? falha}</p>}
    </div>
  );
}
