"use client";

import { useState, useTransition } from "react";
import { atualizarLead } from "./actions";

export const STATUS = ["A contatar", "Contatado", "Respondeu", "Reunião marcada", "Proposta enviada", "Fechado", "Sem interesse", "Descartado"];

function useSalvar(id: number) {
  const [salvando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const salvar = (campo: Parameters<typeof atualizarLead>[1], valor: string) => iniciar(async () => {
    const r = await atualizarLead(id, campo, valor);
    setErro(r && "erro" in r ? r.erro ?? null : null);
  });
  return { salvando, erro, salvar };
}

export function CampoStatus({ id, valor }: { id: number; valor: string }) {
  const { salvando, erro, salvar } = useSalvar(id);
  return (
    <>
      <select defaultValue={valor} disabled={salvando} onChange={(e) => salvar("status", e.target.value)}
        className="campo bg-yellow-50 px-2 py-1 text-xs">
        {STATUS.map((s) => <option key={s}>{s}</option>)}
      </select>
      {erro && <span className="block text-xs text-red-600">{erro}</span>}
    </>
  );
}

export function CampoResponsavel({ id, valor, equipe }: { id: number; valor: number | null; equipe: { id: number; nome: string }[] }) {
  const { salvando, salvar } = useSalvar(id);
  return (
    <select defaultValue={valor ?? ""} disabled={salvando} onChange={(e) => salvar("responsavel_id", e.target.value)}
      className="campo bg-yellow-50 px-2 py-1 text-xs">
      <option value="">—</option>
      {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
    </select>
  );
}

export function CampoData({ id, valor }: { id: number; valor: string | null }) {
  const { salvando, salvar } = useSalvar(id);
  return (
    <input type="date" defaultValue={valor ?? ""} disabled={salvando} onChange={(e) => salvar("data_contato", e.target.value)}
      className="campo bg-yellow-50 px-2 py-1 text-xs" />
  );
}

export function CampoNotas({ id, valor }: { id: number; valor: string | null }) {
  const { salvando, salvar } = useSalvar(id);
  const [texto, setTexto] = useState(valor ?? "");
  return (
    <div className="space-y-1">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4}
        className="campo w-full bg-yellow-50" placeholder="Anotações da ligação…" />
      <button disabled={salvando || texto === (valor ?? "")} onClick={() => salvar("notas", texto)} className="botao-sec text-xs">
        {salvando ? "Salvando…" : "Salvar notas"}
      </button>
    </div>
  );
}
