"use client";

import { useState, useTransition } from "react";
import { salvarAgendamento } from "@/app/agendamentos/actions";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export type AgendamentoSalvo = { horarios: string[]; dias: number[]; ativo: boolean; ultimo_erro: string | null } | null;

export function AgendarRodada({ rodada, inicial }: { rodada: number; inicial: AgendamentoSalvo }) {
  const [aberto, setAberto] = useState(!!inicial);
  const [horarios, setHorarios] = useState<string[]>(inicial?.horarios ?? ["13:00", "17:00"]);
  const [novo, setNovo] = useState("");
  const [dias, setDias] = useState<number[]>(inicial?.dias ?? [1, 2, 3, 4, 5]);
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  if (!aberto) {
    return <button onClick={() => setAberto(true)} className="botao-sec">⏰ Agendar repetição</button>;
  }
  const salvar = () => iniciar(async () => {
    const r = await salvarAgendamento(rodada, horarios, dias, ativo);
    setMsg(r && "erro" in r && r.erro ? { ok: false, t: r.erro } : { ok: true, t: ativo ? "Agendado!" : "Salvo (desligado)." });
  });

  return (
    <section className="cartao w-full space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">⏰ Repetir esta rodada automaticamente</h2>
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4" />
          {ativo ? "Ligado" : "Desligado"}
        </label>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Horários (Brasília):</p>
        <div className="flex flex-wrap items-center gap-2">
          {horarios.map((h) => (
            <span key={h} className="selo gap-1 bg-blue-50 py-1 text-sm text-blue-800">
              {h}<button onClick={() => setHorarios((x) => x.filter((y) => y !== h))} aria-label={`Tirar ${h}`}>×</button>
            </span>
          ))}
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (novo.trim()) setHorarios((x) => [...new Set([...x, novo.trim()])]); setNovo(""); }}>
            <input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="ex.: 20:00" className="campo w-24 py-1" />
            <button className="botao-sec py-1">+</button>
          </form>
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-suave">Dias:</p>
        <div className="flex flex-wrap gap-1.5">
          {DIAS.map((d, i) => (
            <button key={d} type="button" onClick={() => setDias((x) => x.includes(i) ? x.filter((y) => y !== i) : [...x, i])}
              className={`rounded-md border px-2.5 py-1 text-xs ${dias.includes(i) ? "border-marca bg-marca text-white" : "border-borda bg-white"}`}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={salvar} disabled={salvando} className="botao">{salvando ? "Salvando…" : "Salvar agendamento"}</button>
        {msg && <span className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.t}</span>}
      </div>
      {inicial?.ultimo_erro && <p className="text-xs text-red-600">Último problema: {inicial.ultimo_erro}</p>}
      <p className="text-xs text-suave">
        Roda com as mesmas variações e pontos desta rodada, nos horários e dias marcados (pode atrasar até 5 min). Cada horário gasta os mesmos
        créditos desta rodada; se faltar crédito, não roda e avisa aqui. Para pular um dia, é só desligar.
      </p>
    </section>
  );
}
