"use client";

import { useRouter } from "next/navigation";

export function SeletorRodada({ atual, rodadas }: { atual: number; rodadas: { id: number; rotulo: string }[] }) {
  const router = useRouter();
  return (
    <select value={atual} onChange={(e) => router.push(`/relatorios?rodada=${e.target.value}`)} className="campo w-full sm:w-[420px]">
      {rodadas.map((r) => <option key={r.id} value={r.id}>{r.rotulo}</option>)}
    </select>
  );
}
