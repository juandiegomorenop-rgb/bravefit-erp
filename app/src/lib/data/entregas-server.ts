/**
 * Repositorio REAL de Entregas sobre Supabase (server-only).
 *
 * No consulta tablas propias: las entregas SON las OPs reales con
 * fecha_entregada (getOpsRepository de ops-server) — la misma fuente
 * que el kanban, así ambos siempre cuadran. El histórico crecerá solo
 * a medida que se entreguen OPs; no hay filas inventadas.
 *
 * `entregas.ts` conserva tipos + filtro puro + mock (dev sin Supabase).
 */
import {
  aplicarFiltrosEntregas,
  type EntregaRow,
  type EntregasRepository,
  type FiltrosEntregas,
  type ResumenMensual,
} from "@/lib/data/entregas";
import { getOpsRepository } from "@/lib/data/ops-server";
import { productoPrincipal, totalOp } from "@/lib/ops-logic";

class SupabaseEntregasRepository implements EntregasRepository {
  private async todas(): Promise<EntregaRow[]> {
    const cards = await getOpsRepository().listarOps();
    return cards
      .filter((c) => c.tipo === "op" && !!c.fecha_entregada && !c.anulada)
      .map((c) => ({
        op_id: c.op_id,
        numero: c.numero,
        cliente_nombre: c.cliente.nombre,
        ciudad_nombre: c.ciudad?.nombre ?? "—",
        producto_principal: productoPrincipal(c.items)?.producto.nombre ?? "—",
        unidades: c.items.reduce((s, i) => s + i.cantidad, 0),
        valor: totalOp(c.items),
        fecha_entregada: c.fecha_entregada!.slice(0, 10),
        requiere_instalacion: c.requiere_instalacion,
        origen_clave: c.origen.clave,
      }));
  }

  async listar(filtros: FiltrosEntregas = {}): Promise<EntregaRow[]> {
    const filas = aplicarFiltrosEntregas(await this.todas(), filtros);
    filas.sort(
      (a, b) =>
        b.fecha_entregada.localeCompare(a.fecha_entregada) ||
        b.numero.localeCompare(a.numero),
    );
    return filas;
  }

  async resumenMensual(meses: number): Promise<ResumenMensual[]> {
    const hoy = new Date();
    const serie: ResumenMensual[] = [];
    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      serie.push({ mes, entregas: 0, valor: 0 });
    }
    const indice = new Map(serie.map((s, i) => [s.mes, i]));
    for (const e of await this.todas()) {
      const i = indice.get(e.fecha_entregada.slice(0, 7));
      if (i === undefined) continue;
      serie[i].entregas += 1;
      serie[i].valor += e.valor;
    }
    return serie;
  }
}

const globalRepo = globalThis as unknown as {
  __entregasRepositorioServer?: EntregasRepository;
};

/** Factory server-only — la página de Entregas consume ESTE. */
export function getEntregasRepository(): EntregasRepository {
  globalRepo.__entregasRepositorioServer ??= new SupabaseEntregasRepository();
  return globalRepo.__entregasRepositorioServer;
}
