import { exigirModulo } from "@/lib/permisos-server";

/**
 * Guard por URL: RRHH se habilita por el módulo o sus sub-permisos
 * (rrhh_vacaciones_tecnicos, rrhh_evaluaciones_tecnicos…) — así
 * Operaciones entra a sus vacaciones/evaluaciones; el detalle fino
 * (salarios, técnicos) lo protege la RLS.
 */
export default async function RrhhLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await exigirModulo("rrhh");
  return <>{children}</>;
}
