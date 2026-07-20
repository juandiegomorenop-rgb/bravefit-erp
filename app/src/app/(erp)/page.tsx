import { kpisDashboard } from "@/lib/data/dashboard-server";
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

  // KPIs reales (OPs/entregas/CRM de Supabase; RRHH sigue mock y la UI
  // lo marca). Capacidad de planta: oculta hasta cargar el BOM de tubería.
  const kpis = await kpisDashboard(rango);

  return <DashboardClient periodo={periodo} kpis={kpis} />;
}
