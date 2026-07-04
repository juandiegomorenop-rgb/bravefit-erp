import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para componentes de cliente (navegador).
 *  Usa SIEMPRE la anon key + JWT del usuario; la service_role jamás llega aquí. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
