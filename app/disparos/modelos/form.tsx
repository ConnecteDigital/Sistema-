"use client";

import { useState, useTransition } from "react";
import { criarModeloAcao } from "../actions";

const PADRAO = "Olá! Aqui é o Gabriel, da Connect Digital. Analisamos o anúncio da {{1}} no Google e vimos que {{2}}. Posso te mostrar em 5 minutos como resolver?";

export function FormModelo({ telefonePadrao }: { telefonePadrao: string }) {
  const [nome, setNome] = useState("prospeccao_problema_anuncio");
  const [categoria, setCategoria] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [corpo, setCorpo] = useState(PADRAO);
  const [exemplos, setExemplos] = useState(["Desentupidora Exemplo", "o seu site está fora do ar e o anúncio continua rodando"]);
  const [rodape, setRodape] = useState("Connect Digital · Google Ads");
  const [botaoInteresse, setBotaoInteresse] = useState("");
  const [botaoSair, setBotaoSair] = useState("Não tenho interesse");
  const [ligarTexto, setLigarTexto] = useState("Ligar para a Connect");
  const [ligarNumero, setLigarNumero] = useState(telefonePadrao);
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [enviando, iniciar] = useTransition();
  const qtd = Math.max(0, ...[...corpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));

  return (
    <form className="cartao space-y-3 p-4 text-sm" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => setMsg(await criarModeloAcao({
        nome, categoria, idioma: "pt_BR", corpo, exemplos, rodape, botaoInteresse, botaoSair, botaoLigarTexto: ligarTexto, botaoLigarNumero: ligarNumero,
      })));
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">Nome do modelo (sem espaço)
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="campo w-full font-mono" required />
        </label>
        <label className="space-y-1">Categoria
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as "MARKETING" | "UTILITY")} className="campo w-full">
            <option value="MARKETING">Marketing (prospecção)</option>
            <option value="UTILITY">Utilidade (avisos sobre algo já combinado)</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1">Texto da mensagem — use {"{{1}}"}, {"{{2}}"}… para o que muda em cada cliente
        <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={4} className="campo w-full" required />
      </label>
      {qtd > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-suave">Exemplos para a Meta aprovar (um por variável):</p>
          {Array.from({ length: qtd }, (_, i) => (
            <input key={i} value={exemplos[i] ?? ""} placeholder={`exemplo de {{${i + 1}}}`}
              onChange={(e) => setExemplos((x) => { const n = [...x]; n[i] = e.target.value; return n; })} className="campo w-full" />
          ))}
        </div>
      )}
      <label className="block space-y-1">Rodapé (opcional)
        <input value={rodape} onChange={(e) => setRodape(e.target.value)} className="campo w-full" maxLength={60} />
      </label>
      <p className="text-xs text-suave">Botões são opcionais: deixe em branco para mandar sem botão. Clicar em qualquer botão de resposta conta como resposta do cliente (abre as 24h).</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">Botão de interesse (resposta rápida)
          <input value={botaoInteresse} onChange={(e) => setBotaoInteresse(e.target.value)} placeholder="ex.: Pode falar 👍" className="campo w-full" maxLength={25} />
        </label>
        <label className="space-y-1">Botão de sair (resposta rápida)
          <input value={botaoSair} onChange={(e) => setBotaoSair(e.target.value)} className="campo w-full" maxLength={25} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">Botão de ligar — texto
          <input value={ligarTexto} onChange={(e) => setLigarTexto(e.target.value)} className="campo w-full" maxLength={25} />
        </label>
        <label className="space-y-1">Botão de ligar — número
          <input value={ligarNumero} onChange={(e) => setLigarNumero(e.target.value)} placeholder="73 99999-9999" className="campo w-full" />
        </label>
      </div>
      <div className="rounded-lg bg-green-50 p-3">
        <p className="whitespace-pre-line">{corpo.replace(/\{\{(\d+)\}\}/g, (_, n) => exemplos[Number(n) - 1] || `[${n}]`)}</p>
        {rodape && <p className="mt-1 text-xs text-suave">{rodape}</p>}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {botaoInteresse && <span className="rounded border border-borda bg-white px-2 py-1">↩ {botaoInteresse}</span>}
          {botaoSair && <span className="rounded border border-borda bg-white px-2 py-1">↩ {botaoSair}</span>}
          {ligarTexto && ligarNumero && <span className="rounded border border-borda bg-white px-2 py-1">📞 {ligarTexto}</span>}
        </div>
      </div>
      <button disabled={enviando} className="botao">{enviando ? "Enviando para a Meta…" : "Criar modelo e enviar para aprovação"}</button>
      {msg && <p className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.msg}</p>}
    </form>
  );
}
