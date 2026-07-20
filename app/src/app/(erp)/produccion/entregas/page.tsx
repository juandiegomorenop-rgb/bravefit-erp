import { getEntregasRepository } from "@/lib/data/entregas-server";
import { EntregasClient } from "./EntregasClient";

export const metadata = { title: "Entregas" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Server component: carga las entregas (histórico + OPs entregadas vivas
 * del kanban) y la serie mensual de 14 meses (hoy mock, mañana la vista
 * v_entregas en Supabase) y delega KPIs, gráfico y tabla al client.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getEntregasRepository();
  const [filas, resumen] = await Promise.all([
    repo.listar(),
    repo.resumenMensual(14),
  ]);

  const mes = primero(sp.mes);
  return (
    <EntregasClient
      filas={filas}
      resumen={resumen}
      filtrosIniciales={{
        mes: mes && /^\d{4}-\d{2}$/.test(mes) ? mes : undefined,
        anio: Number(primero(sp.anio)) || undefined,
        ciudad: primero(sp.ciudad) || undefined,
        texto: primero(sp.q) ?? "",
      }}
    />
  );
}
