import type { Analise } from "@/lib/analise";

/** Bloco "Análise do anúncio": leitura, causas, o que falar e cuidados. */
export function AnaliseAnuncio({ a, compacto = false }: { a: Analise; compacto?: boolean }) {
  return (
    <div className={`space-y-2 ${compacto ? "text-xs" : "text-sm"}`}>
      <p className="font-medium">{a.resumo}</p>
      <ul className="list-inside list-disc space-y-0.5">{a.leitura.map((l) => <li key={l}>{l}</li>)}</ul>
      {a.causas.length > 0 && (
        <div>
          <p className="font-medium">Causas mais comuns:</p>
          <ul className="list-inside list-disc space-y-0.5">{a.causas.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      <div className={`rounded-md border-l-4 p-2 ${a.amostraPequena ? "border-slate-300 bg-slate-50" : "border-green-600 bg-green-50"}`}>
        <p className="font-medium">{a.amostraPequena ? "Antes de usar:" : "O que falar:"}</p>
        <p className={a.amostraPequena ? "" : "italic"}>{a.amostraPequena ? a.abordagem : `“${a.abordagem}”`}</p>
      </div>
      {a.cuidados.map((c) => <p key={c} className="text-amber-800">⚠ {c}</p>)}
    </div>
  );
}
