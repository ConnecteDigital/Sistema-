"use client";

import { useEffect, useRef, useState } from "react";
import type { ResumoContas } from "@/lib/contas-ads";

type Estado = { status: string; resultado?: ResumoContas | null; erro?: string | null; consultado_em?: string; etapa?: number; diag?: unknown };

const data = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

export function ContaGoogleAds({ advertiserId, dominio, inicial }: { advertiserId: number; dominio: string; inicial: Estado | null }) {
  const [e, setE] = useState<Estado | null>(inicial);
  const [falha, setFalha] = useState<string | null>(null);
  const vivo = useRef(true);

  async function acompanhar() {
    for (let i = 0; i < 40 && vivo.current; i++) {         // até ~3 min
      const r = await fetch(`/api/advertisers/${advertiserId}/google-ads`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setFalha(j.erro ?? `HTTP ${r.status}`); return; }
      setE(j);
      if (j.status !== "pendente") return;
      await new Promise((ok) => setTimeout(ok, 5000));
    }
  }
  useEffect(() => {
    vivo.current = true;
    if (inicial?.status === "pendente") acompanhar();
    return () => { vivo.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function iniciar() {
    setFalha(null);
    const r = await fetch(`/api/advertisers/${advertiserId}/google-ads`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setFalha(j.erro ?? `HTTP ${r.status}`); return; }
    setE({ status: "pendente", etapa: 1 });
    acompanhar();
  }

  const res = e?.resultado;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={iniciar} disabled={e?.status === "pendente"} className="botao-sec text-xs">
          {e?.status === "pendente" ? `Consultando… (etapa ${e.etapa ?? 1} de 2)` : e ? "Consultar de novo" : "Ver conta do Google Ads (Transparência)"}
        </button>
        <span className="text-[11px] text-suave">Quem paga o anúncio, não quem registrou o domínio. Usa a DataForSEO (centavos).</span>
      </div>
      {(falha || e?.erro) && <p className="text-xs text-red-600">{falha ?? e?.erro}</p>}
      <p className="text-[11px]">
        <a href={`https://adstransparency.google.com/?region=BR&domain=${encodeURIComponent(dominio)}`} target="_blank" rel="noreferrer"
          className="text-marca hover:underline">Conferir este domínio direto na Central de Transparência do Google →</a>
      </p>
      {e?.status === "pronta" && res && res.contas.length === 0 && (
        <div className="space-y-1 text-xs">
          <p className="text-suave">
            A Central de Transparência não ligou nenhuma conta a este domínio (o Google não lista todos os anunciantes, e a
            DataForSEO pode estar desatualizada). Use o link acima para conferir no site do Google.
          </p>
          {res.parecidas && res.parecidas.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="font-medium">Contas com nome parecido com &quot;{res.buscaNome}&quot; (conferir, não é certeza):</p>
              {res.parecidas.map((p) => (
                <p key={p.advertiserId}>
                  <a href={`https://adstransparency.google.com/advertiser/${p.advertiserId}?region=BR`} target="_blank" rel="noreferrer"
                    className="text-marca hover:underline">{p.nome ?? p.advertiserId}</a>
                  {p.local && ` · ${p.local}`}{p.anuncios !== null && ` · ~${p.anuncios} anúncios`}{p.verificado && " · verificado"}
                </p>
              ))}
            </div>
          )}
          {res.parecidas && res.parecidas.length === 0 && <p className="text-suave">A busca pelo nome &quot;{res.buscaNome}&quot; também não achou contas.</p>}
        </div>
      )}
      {res?.contas.map((c) => (
        <div key={c.advertiserId} className="space-y-0.5 rounded-lg border border-borda bg-slate-50 p-3 text-xs">
          <p className="text-sm font-semibold">
            {c.nome ?? "—"}
            {c.verificado && <span className="selo ml-1 bg-green-100 text-green-800">verificado pelo Google</span>}
            <span className={`selo ml-1 ${c.pareceEmpresa ? "bg-blue-50 text-blue-800" : "bg-amber-100 text-amber-800"}`}>
              {c.pareceEmpresa ? "parece empresa (CNPJ)" : "parece pessoa física (CPF)"}
            </span>
          </p>
          <p>
            Conta <a href={`https://adstransparency.google.com/advertiser/${c.advertiserId}?region=BR`} target="_blank" rel="noreferrer"
              className="font-mono text-marca hover:underline">{c.advertiserId}</a>
            {" · "}{c.anuncios} anúncio(s) · de {data(c.primeiroAnuncio)} até {data(c.ultimoAnuncio)}
          </p>
          {c.sites.length > 0 && <p>Sites anunciados por esta conta: <strong>{c.sites.join(", ")}</strong></p>}
          {c.nome && (
            <p>
              <a href={`https://www.google.com/search?q=${encodeURIComponent(`"${c.nome}" CNPJ`)}`} target="_blank" rel="noreferrer"
                className="text-marca hover:underline">procurar o CNPJ deste nome no Google →</a>
            </p>
          )}
        </div>
      ))}
      {res && res.outrosSites.length > 0 && (
        <p className="text-xs">
          <strong>Outros sites do mesmo anunciante:</strong> {res.outrosSites.join(", ")}
          <span className="block text-suave">Dica: consulte o dono deles em &quot;Outros sites deste dono&quot;, aqui embaixo.</span>
        </p>
      )}
      {e?.status === "pronta" && e.diag != null && (
        <details className="text-[11px] text-suave">
          <summary className="cursor-pointer">Resposta da DataForSEO (para conferência)</summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-100 p-2">{JSON.stringify(e.diag, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
