import { type FiltrosAnalisis } from "@/lib/data/analisis-ventas";
import { getAnalisisVentasRepository } from "@/lib/data/analisis-ventas-server";
import { AnalisisVentasClient, type PeriodoAn } from "./AnalisisVentasClient";

export const metadata = { title: "Análisis de ventas" };

type SearchParams = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function rangoDe(periodo: PeriodoAn): { desde: string; hasta: string } {
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (periodo === "trimestre") {
    return { desde: iso(new Date(hoy.getTime() - 89 * 86_400_000)), hasta: iso(hoy) };
  }
  if (periodo === "anio") {
    return { desde: iso(new Date(hoy.getFullYear(), 0, 1)), hasta: iso(hoy) };
  }
  if (periodo === "12m") {
    return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1)), hasta: iso(hoy) };
  }
  return { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy) }; // mes
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const pParam = primero(sp.periodo);
  const periodo: PeriodoAn =
    pParam === "mes" || pParam === "trimestre" || pParam === "anio" || pParam === "12m"
      ? pParam
      : "12m";

  const segParam = primero(sp.segmento);
  const segmento = segParam === "B2B" || segParam === "B2C" ? segParam : undefined;

  const origParam = primero(sp.origen);
  const origenProducto =
    origParam === "propio" || origParam === "comercializado" ? origParam : undefined;

  const filtros: FiltrosAnalisis = { ...rangoDe(periodo), segmento, origenProducto };
  const resumen = await getAnalisisVentasRepository().resumen(filtros);

  return (
    <AnalisisVentasClient
      periodo={periodo}
      segmento={segmento ?? null}
      origen={origenProducto ?? null}
      resumen={resumen}
    />
  );
}
