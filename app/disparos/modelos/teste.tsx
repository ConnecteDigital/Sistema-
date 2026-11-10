"use client";

import { useState, useTransition } from "react";
import { enviarTesteAcao } from "../actions";

type M = { nome: string; idioma: string; parametros: number; corpo: string };

export function FormTeste({ modelos }: { modelos: M[] }) {
  const [tel, setTel] = useState("");
  const [sel, setSel] = useState(modelos[0] ? `${modelos[0].nome}|${modelos[0].idioma}` : "");
  const modelo = modelos.find((m) => `${m.nome}|${m.idioma}` === sel);
  const [params, setParams] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [enviando, iniciar] = useTransition();
  if (!modelos.length) return <p className="text-sm text-suave">Nenhum modelo aprovado ainda.</p>;
  return (
    <form className="space-y-2 text-sm" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => setMsg(await enviarTesteAcao(tel, modelo!.nome, modelo!.idioma, Array.from({ length: modelo!.parametros }, (_, i) => params[i] ?? ""))));
    }}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="WhatsApp que vai receber (ex.: 73 99999-9999)" required className="campo flex-1" />
        <select value={sel} onChange={(e) => { setSel(e.target.value); setParams([]); }} className="campo">
          {modelos.map((m) => <option key={m.nome + m.idioma} value={`${m.nome}|${m.idioma}`}>{m.nome} ({m.idioma})</option>)}
        </select>
      </div>
      {modelo && Array.from({ length: modelo.parametros }, (_, i) => (
        <input key={i} value={params[i] ?? ""} placeholder={`valor de {{${i + 1}}}`}
          onChange={(e) => setParams((x) => { const n = [...x]; n[i] = e.target.value; return n; })} className="campo w-full" />
      ))}
      {modelo && <p className="rounded bg-slate-50 p-2 text-xs text-suave whitespace-pre-line">{modelo.corpo}</p>}
      <button disabled={enviando} className="botao">{enviando ? "Enviando…" : "Enviar mensagem de teste"}</button>
      {msg && <p className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.msg}</p>}
    </form>
  );
}
