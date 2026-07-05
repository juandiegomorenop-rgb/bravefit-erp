import { getDashboardRepository } from "@/lib/data/dashboard";
import type { RangoFechas } from "@/lib/data/mercadeo";
import { DashboardClient, type PeriodoDash } from "./DashboardClient";

export const metadata = { title: "Dashboard" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

function rangoDe(periodo: PeriodoDash): RangoFechas {
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (periodo === "mes") {
    return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) };
  }
  if (periodo === "trimestre") {
    return { desde: iso(new Date(hoy.getTime() - 89 * 86_400_000)), hasta: iso(hoy) };
  }
  return { desde: iso(new Date(hoy.getFullYear(), 0, 1)), hasta: iso(hoy) }; // año
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const pParam = primero(sp.periodo);
  const periodo: PeriodoDash =
    pParam === "mes" || pParam === "trimestre" || pParam === "anio" ? pParam : "mes";
  const rango = rangoDe(periodo);

  const repo = getDashboardRepository();
  const [kpis, capacidad, cuellos] = await Promise.all([
    repo.kpis(rango),
    repo.capacidadTuberia(12),
    repo.cuellosBotella(12),
  ]);

  return (
    <DashboardClient
      periodo={periodo}
      kpis={kpis}
      capacidad={capacidad}
      cuellos={cuellos}
    />
  );
}
