import { variaveisFaltando } from "@/lib/env";

/** Mostra quais variáveis de ambiente faltam (sem nunca mostrar valores). */
export function AvisoConfiguracao() {
  const faltando = variaveisFaltando();
  if (faltando.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-medium">Faltam variáveis de ambiente na Vercel:</p>
      <ul className="mt-1 list-inside list-disc">
        {faltando.map((v) => <li key={v}><code>{v}</code></li>)}
      </ul>
      <p className="mt-2">Vercel → projeto → Settings → Environment Variables. Depois, faça um novo deploy.</p>
    </div>
  );
}
