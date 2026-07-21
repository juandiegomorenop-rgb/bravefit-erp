import { resumenCumplimiento } from "@/lib/data/cumplimiento-server";
import { puedeVer } from "@/lib/permisos";
import { cargarPermisos } from "@/lib/permisos-server";
import { CumplimientoClient } from "./CumplimientoClient";

export const metadata = { title: "Nivel de cumplimiento" };

type SearchParams = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const meses = Math.max(3, Math.min(24, Number(primero(sp.meses)) || 12));
  const [resumen, permisos] = await Promise.all([
    resumenCumplimiento(meses),
    cargarPermisos(),
  ]);
  return (
    <CumplimientoClient
      resumen={resumen}
      meses={meses}
      mostrarValores={puedeVer(permisos, "ventas")}
    />
  );
}
