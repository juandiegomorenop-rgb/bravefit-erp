import { getRrhhRepository } from "@/lib/data/rrhh";
import { ReclutamientoClient } from "./ReclutamientoClient";

export const metadata = { title: "Reclutamiento" };

export default async function Page() {
  const vacantes = await getRrhhRepository().listarVacantes();
  return <ReclutamientoClient vacantes={vacantes} />;
}
