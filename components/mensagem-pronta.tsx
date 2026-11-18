"use client";

import { useEffect, useMemo, useState } from "react";
import { linkWhatsComTexto, montarMensagem, type DadosMensagem } from "@/lib/mensagem";

const CHAVE_NOME = "mensagem-remetente";

/** Botão "Mensagem pronta": monta o texto com a análise do lead, deixa editar e abre o WhatsApp já escrito. */
export function MensagemPronta({ telefone, dados }: { telefone: string | null; dados: Omit<DadosMensagem, "remetente"> }) {
  const [aberto, setAberto] = useState(false);
  const [remetente, setRemetente] = useState("Gabriel");
  const [texto, setTexto] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    try { const n = localStorage.getItem(CHAVE_NOME); if (n) setRemetente(n); } catch { /* sem armazenamento: usa o padrão */ }
  }, []);

  const gerado = useMemo(() => montarMensagem({ ...dados, remetente }), [dados, remetente]);
  const abrir = () => { setTexto(gerado); setAberto(true); };
  const link = linkWhatsComTexto(telefone, texto);

  if (!aberto) {
    return <button type="button" onClick={abrir} className="botao">💬 Mensagem pronta</button>;
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">Assinar como
          <input value={remetente} onChange={(e) => {
            setRemetente(e.target.value);
            try { localStorage.setItem(CHAVE_NOME, e.target.value); } catch { /* ignora */ }
          }} className="campo w-32 py-1" />
        </label>
        <button type="button" onClick={() => setTexto(montarMensagem({ ...dados, remetente }))} className="text-marca hover:underline">
          refazer o texto
        </button>
      </div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={9} className="campo w-full text-sm" />
      <p className="text-xs text-suave">Revise antes de enviar: o texto vem da análise do robô. Pode editar à vontade.</p>
      <div className="flex flex-wrap gap-2">
        {link
          ? <a href={link} target="_blank" rel="noreferrer" className="botao">Abrir no WhatsApp</a>
          : <span className="text-xs text-amber-700">Sem celular válido para WhatsApp: use Copiar e cole na conversa.</span>}
        <button type="button" className="botao-sec" onClick={async () => {
          try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão */ }
        }}>{copiado ? "Copiado ✓" : "Copiar"}</button>
        <button type="button" className="botao-sec" onClick={() => setAberto(false)}>Fechar</button>
      </div>
    </div>
  );
}
