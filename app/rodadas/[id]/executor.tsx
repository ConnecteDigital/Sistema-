"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Progresso = {
  status: string; total: number; feitas: number; erros: number; anunciantes: number; erro: string | null; terminou: boolean;
  sitesTotal: number; sitesVerificados: number;
};

/** Chama /work em sequência até a rodada terminar, atualizando a tela a cada lote. */
export function Executor({ runId, inicial, semLeads }: { runId: number; inicial: Progresso; semLeads: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(inicial);
  const [falha, setFalha] = useState<string | null>(null);
  const [rodando, setRodando] = useState(!inicial.terminou && !inicial.erro);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    if (!rodando) return;
    let falhasSeguidas = 0;
    (async () => {
      while (vivo.current) {
        try {
          const r = await fetch(`/api/runs/${runId}/work`, { method: "POST" });
          const j = await r.json();
          if (!r.ok) throw new Error(j.erro || `HTTP ${r.status}`);
          falhasSeguidas = 0;
          setP(j); setFalha(null);
          router.refresh();
          if (j.terminou || j.erro) break;
        } catch (e) {
          falhasSeguidas++;
          setFalha(e instanceof Error ? e.message : String(e));
          if (falhasSeguidas >= 5) break;
          await new Promise((res) => setTimeout(res, 3000));
        }
      }
      if (vivo.current) setRodando(false);
    })();
    return () => { vivo.current = false; };
  }, [rodando, runId, router]);

  async function continuar() {
    await fetch(`/api/runs/${runId}/retomar`, { method: "POST" });
    setP((x) => ({ ...x, erro: null }));
    setFalha(null);
    setRodando(true);
  }

  async function verificarSites() {
    await fetch(`/api/runs/${runId}/reprocessar`, { method: "POST" });
    setP((x) => ({ ...x, status: "verificando", terminou: false, erro: null }));
    setRodando(true);
  }

  if (p.terminou && !rodando) {
    if (!semLeads) return null;
    return (
      <div className="cartao flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <span>Esta rodada foi feita antes da verificação de sites. Quer verificar os sites e gerar os leads agora? (grátis)</span>
        <button onClick={verificarSites} className="botao">Verificar sites</button>
      </div>
    );
  }
  const verificando = p.status === "verificando";
  const pct = verificando
    ? (p.sitesTotal ? Math.round((p.sitesVerificados / p.sitesTotal) * 100) : 0)
    : (p.total ? Math.round(((p.feitas + p.erros) / p.total) * 100) : 0);
  return (
    <div className="cartao space-y-3 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {rodando ? (verificando ? "Verificando os sites dos anunciantes…" : "Buscando anúncios…") : p.erro ? "Parada" : "Pausada"}
        </span>
        <span className="tabular-nums text-suave">
          {verificando ? `${p.sitesVerificados} / ${p.sitesTotal || "?"} sites` : `${p.feitas + p.erros} / ${p.total} buscas`} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-marca transition-all" style={{ width: `${pct}%` }} />
      </div>
      {p.erros > 0 && <p className="text-xs text-amber-700">{p.erros} busca(s) com erro depois de 3 tentativas.</p>}
      {(p.erro || falha) && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-700">{p.erro ?? falha}</p>
          {!rodando && <button onClick={continuar} className="botao-sec">Continuar</button>}
        </div>
      )}
      {rodando && <p className="text-xs text-suave">Pode deixar esta aba aberta. Se fechar, é só voltar aqui que continua de onde parou.</p>}
    </div>
  );
}
