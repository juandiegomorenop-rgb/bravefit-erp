import { getRrhhRepository } from "@/lib/data/rrhh";
import { VacacionesClient } from "./VacacionesClient";

export const metadata = { title: "Vacaciones" };

/**
 * Server component. NOTA RLS: Ops1 ve las vacaciones de los técnicos y
 * las propias; Ops2 solo las propias — en producción la BD filtra sola
 * con el JWT del usuario. El mock sirve la vista de Admin.
 */
export default async function Page() {
  const repo = getRrhhRepository();
  const [vacaciones, empleados] = await Promise.all([
    repo.listarVacaciones(),
    repo.listarEmpleados(),
  ]);
  return <VacacionesClient vacaciones={vacaciones} empleados={empleados} />;
}
