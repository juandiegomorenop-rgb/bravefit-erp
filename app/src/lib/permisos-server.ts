import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  MODULOS,
  PERMISOS_ADMIN,
  puedeVer,
  type Modulo,
  type Permiso,
} from "@/lib/permisos";

/**
 * Permisos REALES del rol del usuario autenticado (tablas roles/permisos)
 * — reemplaza el PERMISOS_ADMIN hardcodeado del esqueleto. Server-only.
 *
 * Mapeo BD→UI: la BD usa claves granulares además de las de módulo
 * ('rrhh_vacaciones_tecnicos', 'rrhh_evaluaciones_tecnicos'…). Un módulo
 * de la UI queda habilitado si su clave exacta O cualquier sub-clave
 * `<modulo>_*` concede el permiso — así Operaciones 1/2 ven el menú RRHH
 * aunque solo tengan permisos de sub-módulos.
 *
 * Esto es guard de UI: la seguridad real sigue siendo la RLS de la BD.
 * Fallbacks: sin Supabase configurado (dev/esqueleto) → PERMISOS_ADMIN;
 * usuario sin rol o rol sin filas → sin módulos (la RLS igual bloquea).
 */
export const cargarPermisos = cache(async (): Promise<Permiso[]> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: u, error: uErr } = await supabase
      .from("usuarios")
      .select("rol_id")
      .eq("id", user.id)
      .maybeSingle();
    if (uErr || !u) return [];

    const { data: rows, error } = await supabase
      .from("permisos")
      .select("*")
      .eq("rol_id", u.rol_id);
    if (error) throw new Error(error.message);

    return MODULOS.map((modulo) => {
      const propios = (rows ?? []).filter(
        (r) => r.modulo === modulo || String(r.modulo).startsWith(`${modulo}_`),
      );
      return {
        modulo,
        puede_ver: propios.some((r) => r.puede_ver),
        puede_crear: propios.some((r) => r.puede_crear),
        puede_editar: propios.some((r) => r.puede_editar),
        puede_aprobar: propios.some((r) => r.puede_aprobar),
        campos_ocultos: [
          ...new Set(
            propios.flatMap((r) => (r.campos_ocultos as string[]) ?? []),
          ),
        ],
      } satisfies Permiso;
    });
  } catch {
    // Supabase sin configurar (esqueleto/dev): comportamiento previo.
    return PERMISOS_ADMIN;
  }
});

/**
 * Guard de RUTA para layouts de módulo: si el rol no puede ver el
 * módulo, redirige al Dashboard. Con esto las páginas quedan
 * bloqueadas también por URL directa (no solo menú oculto). La
 * seguridad de DATOS sigue siendo la RLS; esto evita que un rol sin
 * Ventas vea siquiera la interfaz (y los datos mock donde aún los hay).
 */
export async function exigirModulo(modulo: Modulo): Promise<void> {
  const permisos = await cargarPermisos();
  if (!puedeVer(permisos, modulo)) redirect("/");
}
