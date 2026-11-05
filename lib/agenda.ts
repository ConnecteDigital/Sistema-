// Quando um agendamento deve disparar (horário de Brasília). Pura.

export type Agendamento = { id: number; horarios: string[]; dias: number[]; ativo: boolean; ultimos: Record<string, number> };

/** Data, dia da semana e minutos do dia em America/Sao_Paulo. */
export function agoraBrasilia(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    weekday: "short", hour12: false,
  }).formatToParts(d).map((x) => [x.type, x.value]));
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const hora = Number(p.hour) % 24;
  return { data: `${p.year}-${p.month}-${p.day}`, diaSemana: dia, minutos: hora * 60 + Number(p.minute) };
}

const paraMin = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + (b || 0); };

/** Horários que já passaram hoje (até 2h de atraso) e ainda não dispararam. */
export function horariosDevidos(a: Agendamento, agora = agoraBrasilia()): string[] {
  if (!a.ativo || !a.dias.includes(agora.diaSemana)) return [];
  return a.horarios.filter((h) => {
    const m = paraMin(h);
    return agora.minutos >= m && agora.minutos - m <= 120 && !(`${agora.data} ${h}` in (a.ultimos ?? {}));
  });
}

export function normalizarHorario(h: string): string | null {
  const m = h.trim().match(/^(\d{1,2})(?::|h)?(\d{2})?$/i);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2] ?? 0);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
