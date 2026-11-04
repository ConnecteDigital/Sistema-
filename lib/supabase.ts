import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exigir } from "./env";

let cliente: SupabaseClient | null = null;

/**
 * Cliente do Supabase com a chave SECRETA. Só roda no servidor.
 * O navegador nunca fala com o Supabase direto (RLS sem políticas bloqueia a chave pública).
 */
export function db(): SupabaseClient {
  if (!cliente) {
    cliente = createClient(exigir("SUPABASE_URL"), exigir("SUPABASE_SECRET_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cliente;
}
