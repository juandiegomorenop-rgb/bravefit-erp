/**
 * Análisis de ventas REAL (server-only): aplana las OPs reales de
 * Supabase (misma fuente que el kanban; anuladas excluidas) con las
 * categorías reales del catálogo. El cálculo es calcularResumenAnalisis
 * — compartido con el mock. El histórico Siigo aún no está cargado:
 * la serie muestra solo lo que vive en el ERP.
 */
import {
  calcularResumenAnalisis,
  type AnalisisVentasRepository,
  type FiltrosAnalisis,
  type ResumenAnalisis,
} from "@/lib/data/analisis-ventas";
import { getOpsRepository } from "@/lib/data/ops-server";
import { getProductosRepository } from "@/lib/data/productos-server";

class SupabaseAnalisisVentasRepository implements AnalisisVentasRepository {
  async resumen(filtros: FiltrosAnalisis): Promise<ResumenAnalisis> {
    const [cards, categorias] = await Promise.all([
      getOpsRepository().listarOps(),
      getProductosRepository().listarCategorias(),
    ]);
    const catNombre = new Map(categorias.map((c) => [c.id, c.nombre]));
    return calcularResumenAnalisis(
      cards.filter((c) => !c.anulada),
      catNombre,
      filtros,
    );
  }
}

const g = globalThis as unknown as {
  __analisisVentasRepoServer?: AnalisisVentasRepository;
};

/** Factory server-only — la página de Análisis consume ESTE. */
export function getAnalisisVentasRepository(): AnalisisVentasRepository {
  g.__analisisVentasRepoServer ??= new SupabaseAnalisisVentasRepository();
  return g.__analisisVentasRepoServer;
}
