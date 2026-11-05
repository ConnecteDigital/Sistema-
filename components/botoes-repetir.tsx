import Link from "next/link";
import { repetirRodada } from "@/app/actions";

/** "Repetir agora" (mesmas palavras e pontos) e "Ajustar e repetir" (abre a pesquisa preenchida). */
export function BotoesRepetir({ rodada, criadaEm, compacto = false }: { rodada: number; criadaEm: string; compacto?: boolean }) {
  // A SerpApi guarda a mesma busca por 1h: repetir antes disso traz o mesmo resultado (e não gasta crédito)
  const menosDe1h = Date.now() - new Date(criadaEm).getTime() < 3600_000;
  const aviso = menosDe1h ? "Feita há menos de 1h: a SerpApi devolve o mesmo resultado guardado. Para comparar horários, repita depois de 1h." : undefined;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compacto ? "text-xs" : ""}`}>
      <form action={repetirRodada}>
        <input type="hidden" name="rodada" value={rodada} />
        <button className={compacto ? "text-marca hover:underline" : "botao"} title={aviso}>Repetir agora</button>
      </form>
      <Link href={`/?repetir=${rodada}`} className={compacto ? "text-marca hover:underline" : "botao-sec"}>Ajustar e repetir</Link>
      {!compacto && menosDe1h && <span className="text-xs text-amber-700">{aviso}</span>}
    </div>
  );
}
