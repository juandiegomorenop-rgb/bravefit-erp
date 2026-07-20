import { getOpsRepository } from "@/lib/data/ops-server";
import type { SemaforoOp } from "@/lib/ops-logic";
import { puedeVer } from "@/lib/permisos";
import { cargarPermisos } from "@/lib/permisos-server";
import { OrdenesClient, type CampoFechaCal, type Vista } from "./OrdenesClient";

export const metadata = { title: "Órdenes de pedido" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const SEMAFOROS: SemaforoOp[] = ["ninguno", "amarillo", "rojo", "negro"];

/**
 * Server component: carga datos (hoy mock, mañana Supabase) y delega la
 * interacción (vistas, filtros, drag & drop) al client component.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getOpsRepository();
  const [cards, etapas, origenes, ciudades, permisos] = await Promise.all([
    repo.listarOps(),
    repo.listarEtapas(),
    repo.listarOrigenes(),
    repo.listarCiudades(),
    cargarPermisos(),
  ]);
  // Cifras de dinero (valor por OP y suma por etapa) = información de
  // Ventas: solo las ven los roles con ese módulo (Admins).
  const mostrarValores = puedeVer(permisos, "ventas");

  const vistaParam = primero(sp.vista);
  const vista: Vista =
    vistaParam === "lista" || vistaParam === "calendario"
      ? vistaParam
      : "kanban";
  const semParam = primero(sp.semaforo) as SemaforoOp | undefined;
  const campoFechaCal: CampoFechaCal =
    primero(sp.fcal) === "creacion" ? "creacion" : "entrega";

  return (
    <OrdenesClient
      cardsIniciales={cards}
      etapas={etapas}
      origenes={origenes}
      ciudades={ciudades}
      vistaInicial={vista}
      campoFechaCalInicial={campoFechaCal}
      mostrarValores={mostrarValores}
      filtrosIniciales={{
        etapa_id: Number(primero(sp.etapa)) || undefined,
        origen: primero(sp.origen) || undefined,
        ciudad_id: Number(primero(sp.ciudad)) || undefined,
        semaforo: semParam && SEMAFOROS.includes(semParam) ? semParam : undefined,
        texto: primero(sp.q) ?? "",
      }}
    />
  );
}
