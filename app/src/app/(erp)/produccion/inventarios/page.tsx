import { getInventarioRepository } from "@/lib/data/inventario-server";
import { TIPOS_MATERIAL } from "@/lib/data/materiales-mock";
import { InventariosClient } from "./InventariosClient";

export const metadata = { title: "Inventarios" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Server component: carga existencias MP/PT y la serie de compras
 * (hoy mock, mañana Supabase) y delega filtros, tablas y tendencia
 * al client component. Una sola bodega: sin columna de bodega.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getInventarioRepository();
  const [filasMP, filasPT, filasSE, compras] = await Promise.all([
    repo.listarExistenciasMP(),
    repo.listarExistenciasPT(),
    repo.listarExistenciasSubensambles(),
    repo.comprasMensuales(8),
  ]);

  return (
    <InventariosClient
      filasMP={filasMP}
      filasPT={filasPT}
      filasSE={filasSE}
      compras={compras}
      tipos={TIPOS_MATERIAL}
      filtrosIniciales={{
        tipo_material_id: Number(primero(sp.tipo)) || undefined,
        texto: primero(sp.q) ?? "",
        solo_bajo_buffer: primero(sp.bajo) === "1",
      }}
    />
  );
}
