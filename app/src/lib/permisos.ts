import type { NavItem } from "@/lib/nav";

/**
 * RBAC ERP Bravefit — espejo de las tablas `roles` + `permisos` (Supabase).
 * La seguridad real vive en RLS (BD) y en el middleware de API;
 * estos helpers son el guard de UI (menú y campos ocultos).
 */

export type Modulo =
  | "dashboard"
  | "ventas"
  | "produccion"
  | "mercadeo"
  | "rrhh"
  | "cartelera"
  | "chat";

export interface Permiso {
  modulo: Modulo;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
  puede_aprobar: boolean;
  /** Campos que este rol no debe ver (ej. "salario", "costo"). */
  campos_ocultos: string[];
}

export const MODULOS: Modulo[] = [
  "dashboard",
  "ventas",
  "produccion",
  "mercadeo",
  "rrhh",
  "cartelera",
  "chat",
];

/** Permisos de Administrador (todo visible). Útil como fallback del esqueleto
 *  mientras la tabla `permisos` no está poblada. */
export const PERMISOS_ADMIN: Permiso[] = MODULOS.map((modulo) => ({
  modulo,
  puede_ver: true,
  puede_crear: true,
  puede_editar: true,
  puede_aprobar: true,
  campos_ocultos: [],
}));

export function puedeVer(permisos: Permiso[], modulo: Modulo): boolean {
  return permisos.some((p) => p.modulo === modulo && p.puede_ver);
}

/** Filtra la navegación data-driven según los permisos del usuario. */
export function filtrarNav(nav: NavItem[], permisos: Permiso[]): NavItem[] {
  return nav
    .filter((item) => puedeVer(permisos, item.modulo))
    .map((item) =>
      item.children
        ? {
            ...item,
            children: item.children.filter((c) => puedeVer(permisos, c.modulo)),
          }
        : item,
    );
}

/** Devuelve una copia del objeto sin los campos ocultos para el rol. */
export function ocultarCampos<T extends Record<string, unknown>>(
  objeto: T,
  campos_ocultos: string[],
): Partial<T> {
  if (campos_ocultos.length === 0) return { ...objeto };
  const copia: Partial<T> = {};
  for (const clave of Object.keys(objeto) as (keyof T)[]) {
    if (!campos_ocultos.includes(String(clave))) copia[clave] = objeto[clave];
  }
  return copia;
}
