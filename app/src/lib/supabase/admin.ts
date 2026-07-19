import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Cliente Supabase ADMIN (service_role) — SOLO para route handlers de
 * integraciones (planner, webhooks Shopify/Siigo) que no tienen sesión
 * de usuario. Bypasa RLS: cada endpoint que lo use DEBE validar su
 * propia autenticación (API key en header) antes de tocar la base.
 * Nunca importar desde componentes ni exponer la key al cliente.
 */
let admin: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada en este entorno.",
    );
  }
  admin ??= createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
