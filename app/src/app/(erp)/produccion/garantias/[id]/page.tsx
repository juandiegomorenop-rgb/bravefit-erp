import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeGarantia } from "@/app/(erp)/produccion/ordenes/badges";
import { getOpsRepository } from "@/lib/data/ops";
import { USUARIOS } from "@/lib/data/ops";
import { formatCOP, formatFechaHora } from "@/lib/formato";
import { EditarGarantia } from "./EditarGarantia";

export const metadata = { title: "Garantía" };

/**
 * Detalle de garantía: la "hoja de ambulancia" — falla, pieza, recogida,
 * vínculos a OP/cotización, costo de resolución y su posición en el
 * flujo de producción (la etapa se mueve desde el kanban de OPs).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const det = await getOpsRepository().obtenerGarantia(id);
  if (!det) notFound();

  const g = det.garantia;
  const abierta = !g.cerrada_en;

  return (
    <div className="mx-auto max-w-[860px]">
      <p className="text-[12.5px] text-neutro">
        <Link href="/produccion/garantias" className="hover:underline">
          Producción / Garantías
        </Link>{" "}
        / {g.numero}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <BadgeGarantia grande />
        <h1 className="text-[28px] font-extrabold tracking-tight">{g.numero}</h1>
        {abierta ? (
          <span className="rounded-pill bg-azul-bg px-3 py-1 text-[12px] font-bold text-azul">
            {det.etapa.nombre} · {det.dias === 0 ? "abierta hoy" : `${det.dias} días abierta`}
          </span>
        ) : (
          <span className="rounded-pill bg-verde-bg px-3 py-1 text-[12px] font-bold text-verde">
            Cerrada en {det.dias} días
          </span>
        )}
      </div>
      {abierta && (
        <p className="mt-1 text-[12.5px] font-semibold text-semaforo-rojo">
          Prioridad ambulancia: va de primeras en la etapa "{det.etapa.nombre}" del
          kanban de producción.
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Columna principal */}
        <div className="space-y-4">
          <div className="rounded-card border border-borde bg-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Falla reportada
            </p>
            <p className="mt-1 text-[16px] font-bold">{g.problema}</p>
            {g.detalle && (
              <p className="mt-2 text-[13px] leading-relaxed text-neutro">{g.detalle}</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                  Producto
                </p>
                <p className="font-semibold">{det.producto?.nombre ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                  Abierta
                </p>
                <p className="font-semibold">{formatFechaHora(new Date(g.abierta_en))}</p>
              </div>
              {g.cerrada_en && (
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                    Cerrada
                  </p>
                  <p className="font-semibold">{formatFechaHora(new Date(g.cerrada_en))}</p>
                </div>
              )}
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                  Costo de resolución
                </p>
                <p className="font-semibold">
                  {g.costo_resolucion ? formatCOP(g.costo_resolucion) : "Sin registrar"}
                </p>
              </div>
            </div>
          </div>

          {/* Edición: recogida, vendedor, costo, detalle */}
          <EditarGarantia garantia={g} usuarios={USUARIOS} />
        </div>

        {/* Lateral: cliente + vínculos */}
        <div className="space-y-4">
          <div className="rounded-card border border-borde bg-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Cliente
            </p>
            <p className="mt-1 text-[14px] font-bold">{det.cliente.nombre}</p>
            <p className="text-[12.5px] leading-relaxed text-neutro">
              {det.ciudad?.nombre}
              {det.cliente.telefono && (
                <>
                  <br />
                  {det.cliente.telefono}
                </>
              )}
              {det.cliente.email && (
                <>
                  <br />
                  {det.cliente.email}
                </>
              )}
            </p>
          </div>

          <div className="rounded-card border border-borde bg-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Documentos vinculados
            </p>
            <div className="mt-2 space-y-1.5 text-[13px]">
              <p>
                O.P. de origen:{" "}
                <Link
                  href={`/produccion/ordenes/${det.op.id}`}
                  className="font-bold text-azul hover:underline"
                >
                  {det.op_numero}
                </Link>
              </p>
              <p>
                Cotización:{" "}
                {det.op.cotizacion_id ? (
                  <span className="font-semibold">vinculada a la O.P.</span>
                ) : (
                  <span className="text-neutro">— (pedido {det.op.pedido_web_id ? "Shopify" : "directo"})</span>
                )}
              </p>
              <p>
                Factura: <span className="text-neutro">se vincula con el sync Siigo</span>
              </p>
              <p>
                Vendedor:{" "}
                <span className="font-semibold">{det.vendedor?.nombre ?? "Por asignar"}</span>
              </p>
            </div>
          </div>

          <div className="rounded-card border border-borde bg-sutil p-5 text-[12.5px] leading-relaxed text-neutro">
            La etapa de la garantía se mueve en el{" "}
            <Link href="/produccion/ordenes?vista=kanban" className="font-bold text-azul hover:underline">
              kanban de producción
            </Link>
            , donde su ficha va SIEMPRE de primeras. Al llegar a "Entregado" la
            garantía se cierra sola. Los consumos de material de la reparación se
            registran en el kardex colgados de esta garantía.
          </div>
        </div>
      </div>
    </div>
  );
}
