"use client";

import { useState, useTransition } from "react";
import { marcarOptin } from "@/app/disparos/actions";

const ORIGENS = [
  { v: "ligacao", r: "Na ligação" }, { v: "whatsapp_manual", r: "Respondeu no WhatsApp do prospectador" },
  { v: "formulario", r: "Formulário / site" }, { v: "outro", r: "Outro" },
];

export function OptinWhatsApp({ leadId, autorizado, saiu, compacto = false }: {
  leadId: number; autorizado: boolean; saiu: boolean; compacto?: boolean;
}) {
  const [ok, setOk] = useState(autorizado);
  const [origem, setOrigem] = useState("ligacao");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  if (saiu) return <span className="selo bg-slate-200 text-slate-600">pediu para sair do WhatsApp</span>;
  const alternar = () => iniciar(async () => {
    const r = await marcarOptin(leadId, !ok, origem);
    if (r && "erro" in r && r.erro) setErro(r.erro); else { setOk(!ok); setErro(null); }
  });

  if (compacto) {
    return (
      <button onClick={alternar} disabled={salvando} title="Autorizou receber WhatsApp?"
        className={`selo whitespace-nowrap ${ok ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
        {salvando ? "…" : ok ? "✓ autorizou WhatsApp" : "+ autorizou WhatsApp"}
      </button>
    );
  }
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={ok} onChange={alternar} disabled={salvando} />
          <span className="font-medium">Autorizou receber WhatsApp</span>
        </label>
        {!ok && (
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="campo px-2 py-0.5 text-xs">
            {ORIGENS.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
          </select>
        )}
      </div>
      <p className="text-suave">Só quem autorizou entra nos disparos (regra da Meta, protege o número).</p>
      {erro && <p className="text-red-600">{erro}</p>}
    </div>
  );
}
