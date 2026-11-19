"use client";

import { useEffect, useState } from "react";

// Leads marcados para baixar contatos (.vcf). Ficam guardados no navegador enquanto você busca e filtra.
const CHAVE = "leads-marcados";
const EVENTO = "leads-marcados-mudou";
type Marcado = { id: number; nome: string };

function ler(): Marcado[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as Marcado[]; } catch { return []; }
}
function gravar(lista: Marcado[]) {
  try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event(EVENTO));
}
function useMarcados(): Marcado[] {
  const [lista, setLista] = useState<Marcado[]>([]);
  useEffect(() => {
    const atualizar = () => setLista(ler());
    atualizar();
    window.addEventListener(EVENTO, atualizar);
    window.addEventListener("storage", atualizar);
    return () => { window.removeEventListener(EVENTO, atualizar); window.removeEventListener("storage", atualizar); };
  }, []);
  return lista;
}

/** Caixinha de cada lead na tabela. */
export function MarcarLead({ id, nome }: { id: number; nome: string }) {
  const lista = useMarcados();
  const marcado = lista.some((m) => m.id === id);
  return (
    <input type="checkbox" checked={marcado} aria-label="Marcar para baixar o contato"
      onChange={() => gravar(marcado ? ler().filter((m) => m.id !== id) : [...ler().filter((m) => m.id !== id), { id, nome }])} />
  );
}

// Número da última leva baixada: a próxima sugere "Prospec 2", "Prospec 3"… (a 1ª leva foi salva como "Prospec")
const CHAVE_LEVA = "contatos-ultima-leva";
function ultimaLeva() { try { return Number(localStorage.getItem(CHAVE_LEVA) ?? "1") || 1; } catch { return 1; } }

/** Barra com os leads marcados (de qualquer busca), para conferir, desmarcar e baixar. */
export function BarraMarcados() {
  const lista = useMarcados();
  const [aberto, setAberto] = useState(false);
  const [prefixo, setPrefixo] = useState("Prospec 2");
  useEffect(() => { setPrefixo(`Prospec ${ultimaLeva() + 1}`); }, []);
  const baixou = () => {
    const n = Number(prefixo.match(/(\d+)\s*$/)?.[1]);
    if (n) { try { localStorage.setItem(CHAVE_LEVA, String(n)); } catch { /* ignora */ } }
    setTimeout(() => setPrefixo(`Prospec ${(n || ultimaLeva()) + 1}`), 500);
  };
  if (!lista.length) {
    return <p className="text-xs text-suave">📇 Marque leads na primeira coluna (pode buscar e filtrar à vontade: a marcação fica guardada) e baixe os contatos de uma vez.</p>;
  }
  const link = `/api/leads/contatos?prefixo=${encodeURIComponent(prefixo)}&${lista.map((m) => `id=${m.id}`).join("&")}`;
  return (
    <div className="cartao space-y-2 border-marca/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong>📇 {lista.length} lead(s) marcado(s)</strong>
        <button type="button" onClick={() => setAberto((a) => !a)} className="text-xs text-marca hover:underline">{aberto ? "esconder" : "ver quais"}</button>
        <label className="ml-auto flex items-center gap-1 text-xs">Salvar como
          <input value={prefixo} onChange={(e) => setPrefixo(e.target.value)} maxLength={30} className="campo w-28 py-1" />
          <span className="text-suave">- Nome</span>
        </label>
        <a href={link} target="_blank" rel="noreferrer" onClick={baixou} className="botao">Baixar contatos (.vcf)</a>
        <button type="button" onClick={() => gravar([])} className="botao-sec">Desmarcar todos</button>
      </div>
      {aberto && (
        <ul className="flex flex-wrap gap-1.5">
          {lista.map((m) => (
            <li key={m.id} className="flex items-center gap-1 rounded-full border border-borda bg-white px-2 py-0.5 text-xs">
              {m.nome}
              <button type="button" aria-label={`Desmarcar ${m.nome}`} onClick={() => gravar(ler().filter((x) => x.id !== m.id))}
                className="text-suave hover:text-red-600">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
