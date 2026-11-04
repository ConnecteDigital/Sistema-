import "server-only";

/** Lista quais variáveis obrigatórias estão faltando (para mostrar na tela, nunca o valor). */
export function variaveisFaltando(): string[] {
  const obrigatorias = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "KEYS_ENCRYPTION_SECRET"];
  return obrigatorias.filter((k) => !process.env[k]?.trim());
}

export function exigir(nome: string): string {
  const v = process.env[nome]?.trim();
  if (!v) throw new Error(`Variável de ambiente ${nome} não configurada.`);
  return v;
}
