"use client";

import { useEffect, useState, useTransition } from "react";
import type { Modelo } from "@/lib/whatsapp";
import { criarCampanhaAcao, previaPublico } from "../actions";

type Previa = Awaited<ReturnType<typeof previaPublico>>;
const PRIORIDADES = ["Máxima", "Alta", "Normal", "Baixa"];

export function FormCampanha({ modelos, rodadas, variaveis, ritmoPadrao, custo }: {
  modelos: Modelo[]; rodadas: { id: number; rotulo: string }[]; variaveis: Record<string, string>; ritmoPadrao: number; custo: number;
}) {
  const [modelo, setModelo] = useState(modelos[0]);
  const [mapa, setMapa] = useState<string[]>([]);
  const [rodada, setRodada] = useState<string>(rodadas[0] ? String(rodadas[0].id) : "");
  const [prios, setPrios] = useState<string[]>(["Máxima", "Alta"]);
  const [nome, setNome] = useState("");
  const [ritmo, setRitmo] = useState(ritmoPadrao);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, iniciar] = useTransition();

  useEffect(() => {
    setMapa(Array.from({ length: modelo.parametros }, (_, i) => ["empresa", "problema", "site", "regiao"][i] ?? "empresa"));
  }, [modelo]);
  useEffect(() => {
    let vivo = true;
    previaPublico({ rodada: rodada ? Number(rodada) : null, prioridades: prios }).then((p) => vivo && setPrevia(p)).catch(() => {});
    return () => { vivo = false; };
  }, [rodada, prios]);

  const exemplo = modelo.corpo.replace(/\{\{(\d+)\}\}/g, (_, n) => `[${variaveis[mapa[Number(n) - 1]] ?? "?"}]`);

  return (
    <div className="space-y-4">
      <section className="cartao space-y-3 p-4">
        <h2 className="font-semibold">1. Mensagem</h2>
        <select value={modelo.nome + "|" + modelo.idioma} onChange={(e) => setModelo(modelos.find((m) => m.nome + "|" + m.idioma === e.target.value)!)} className="campo w-full">
          {modelos.map((m) => <option key={m.nome + m.idioma} value={m.nome + "|" + m.idioma}>{m.nome} ({m.idioma} · {m.categoria})</option>)}
        </select>
        {mapa.map((v, i) => (
          <label key={i} className="flex items-center gap-2 text-sm">
            <span className="w-12 font-mono">{`{{${i + 1}}}`}</span>
            <select value={v} onChange={(e) => setMapa((m) => m.map((x, j) => (j === i ? e.target.value : x)))} className="campo flex-1">
              {Object.entries(variaveis).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select>
          </label>
        ))}
        <p className="whitespace-pre-line rounded-lg bg-green-50 p-3 text-sm">{exemplo}</p>
      </section>

      <section className="cartao space-y-3 p-4">
        <h2 className="font-semibold">2. Quem recebe</h2>
        <select value={rodada} onChange={(e) => setRodada(e.target.value)} className="campo w-full">
          <option value="">Todos os leads</option>
          {rodadas.map((r) => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {PRIORIDADES.map((p) => (
            <label key={p} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={prios.includes(p)} onChange={() => setPrios((x) => x.includes(p) ? x.filter((y) => y !== p) : [...x, p])} />{p}
            </label>
          ))}
        </div>
        {previa && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p><strong className="text-lg text-green-700">{previa.elegiveis}</strong> vão receber (têm celular e autorizaram)</p>
            <p className="text-xs text-suave">
              De {previa.total} leads: {previa.semCelular} sem celular · <strong>{previa.semAutorizacao} sem autorização</strong> · {previa.sairam} pediram para sair.
              {previa.semAutorizacao > 0 && " Para incluir, marque “autorizou WhatsApp” no lead depois da ligação."}
            </p>
            <p className="mt-1 text-xs">Custo estimado na Meta: ~US$ {(previa.elegiveis * custo).toFixed(2)} (≈ US$ {custo} por mensagem de marketing)</p>
          </div>
        )}
      </section>

      <section className="cartao space-y-3 p-4">
        <h2 className="font-semibold">3. Envio</h2>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da campanha (ex.: Site fora do ar — SP)" className="campo w-full" />
        <label className="flex items-center gap-2 text-sm">Ritmo:
          <input type="number" min={1} max={60} value={ritmo} onChange={(e) => setRitmo(Number(e.target.value))} className="campo w-20" /> mensagens por minuto
        </label>
        <button disabled={criando || !previa?.elegiveis} className="botao w-full py-3" onClick={() => {
          setErro(null);
          iniciar(async () => {
            const r = await criarCampanhaAcao({ nome, modelo: modelo.nome, idioma: modelo.idioma, variaveis: mapa,
              filtro: { rodada: rodada ? Number(rodada) : null, prioridades: prios }, ritmo });
            if (r?.erro) setErro(r.erro);
          });
        }}>{criando ? "Criando…" : `Criar campanha (${previa?.elegiveis ?? 0} contatos)`}</button>
        <p className="text-xs text-suave">A campanha é criada pausada. Você confere a lista e clica em “Começar a enviar”.</p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </section>
    </div>
  );
}
