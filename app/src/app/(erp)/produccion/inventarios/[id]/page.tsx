import Link from "next/link";
import { notFound } from "next/navigation";
import {
  estadoBuffer,
  TIPO_MOVIMIENTO_LABEL,
  UNIDAD_LABEL,
} from "@/lib/data/inventario";
import { getInventarioRepository } from "@/lib/data/inventario-server";
import { MATERIALES } from "@/lib/data/materiales-mock";
import { formatCOP, formatFechaHora } from "@/lib/formato";
import type { MovimientoInventario } from "@/lib/types/db";
import { BadgeEstadoBuffer, BarraBuffer, formatCantidad } from "../ui";
import { RegistrarAjuste } from "./RegistrarAjuste";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const material = MATERIALES.find((m) => m.id === id);
  return { title: material ? `Kardex · ${material.nombre}` : "Kardex" };
}

/** Pill del tipo de movimiento: verde entradas, rojo salidas, azul ajustes. */
const PILL_MOVIMIENTO: Record<MovimientoInventario["tipo"], string> = {
  entrada_compra: "bg-verde-bg text-verde",
  entrada_produccion: "bg-verde-bg text-verde",
  devolucion: "bg-verde-bg text-verde",
  entrada_garantia: "bg-verde-bg text-verde",
  salida_produccion: "bg-rojo-bg text-rojo",
  salida_venta: "bg-rojo-bg text-rojo",
  salida_garantia: "bg-rojo-bg text-rojo",
  ajuste: "bg-azul-bg text-azul",
};

/**
 * Kardex del material — server component (solo lectura) con isla
 * cliente para registrar ajustes (server action + router.refresh).
 */
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const repo = getInventarioRepository();
  const [filas, movimientos] = await Promise.all([
    repo.listarExistenciasMP(),
    repo.kardex(id),
  ]);
  const fila = filas.find((f) => f.material.id === id);
  if (!fila) notFound();

  const { existencia, material, tipo } = fila;
  const estado = estadoBuffer(existencia.cantidad_disponible, material);
  const unidad = UNIDAD_LABEL[material.unidad_id] ?? "";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/produccion/inventarios"
            className="text-[12.5px] font-semibold text-dorado-oscuro hover:underline"
          >
            ← Volver a Inventarios
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] font-bold leading-tight text-carbon">
              {material.nombre}
            </h1>
            <span className="rounded-pill bg-neutro-bg px-2.5 py-0.5 text-[11px] font-bold text-neutro">
              {tipo.nombre}
            </span>
            <BadgeEstadoBuffer
              estado={estado}
              sugerirHref={`/produccion/compras?sugerir=${material.id}&cantidad=${Math.max(
                1,
                Math.ceil(
                  material.buffer_max - existencia.cantidad_disponible,
                ),
              )}`}
            />
          </div>
        </div>
        <RegistrarAjuste existenciaId={existencia.id} unidad={unidad} />
      </div>

      {/* Resumen de la existencia */}
      <div className="mt-5 rounded-card border border-borde bg-card px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-5">
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
              Disponible
            </p>
            <p
              className={`mt-0.5 text-[20px] font-extrabold tracking-tight ${
                estado === "reponer" ? "text-semaforo-rojo" : ""
              }`}
            >
              {formatCantidad(existencia.cantidad_disponible)}{" "}
              <span className="text-[12px] font-semibold text-neutro">
                {unidad}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
              Reservada
            </p>
            <p className="mt-0.5 text-[20px] font-extrabold tracking-tight">
              {formatCantidad(existencia.cantidad_reservada)}{" "}
              <span className="text-[12px] font-semibold text-neutro">
                {unidad}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
              Costo promedio
            </p>
            <p className="mt-0.5 text-[20px] font-extrabold tracking-tight">
              {formatCOP(material.costo_promedio)}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
              Buffer min–max
            </p>
            <p className="mt-0.5 text-[20px] font-extrabold tracking-tight">
              {formatCantidad(material.buffer_min)}–
              {formatCantidad(material.buffer_max)}
            </p>
          </div>
          <div>
            <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
              Valor en bodega
            </p>
            <p className="mt-0.5 text-[20px] font-extrabold tracking-tight">
              {formatCOP(
                existencia.cantidad_disponible * material.costo_promedio,
              )}
            </p>
          </div>
        </div>
        <div className="mt-4 max-w-[420px]">
          <BarraBuffer
            disponible={existencia.cantidad_disponible}
            material={material}
          />
          <p className="mt-1.5 text-[11px] text-neutro">
            Nivel vs buffers de reposición por consumo (marcas: mínimo y
            máximo).
          </p>
        </div>
      </div>

      {/* Kardex */}
      <div className="mt-5 rounded-card border border-borde bg-card">
        <div className="border-b border-borde px-5 py-3.5">
          <h2 className="text-[14px] font-bold">
            Kardex{" "}
            <span className="font-normal text-neutro">
              ({movimientos.length}{" "}
              {movimientos.length === 1 ? "movimiento" : "movimientos"})
            </span>
          </h2>
          <p className="text-[11.5px] text-neutro">
            Inmutable: toda corrección se registra como un ajuste nuevo.
          </p>
        </div>
        <div className="thead-flotante overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-borde bg-sutil text-left text-[11.5px] uppercase tracking-wider text-neutro">
                <th className="px-5 py-2.5 font-semibold">Fecha</th>
                <th className="px-3 py-2.5 font-semibold">Movimiento</th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  Cantidad
                </th>
                <th className="px-3 py-2.5 text-right font-semibold">
                  Costo unit.
                </th>
                <th className="px-5 py-2.5 font-semibold">Nota</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-[#f6f5f2] last:border-b-0"
                >
                  <td className="whitespace-nowrap px-5 py-2.5 text-neutro">
                    {formatFechaHora(new Date(m.en))}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded-pill px-2 py-0.5 text-[11px] font-bold ${PILL_MOVIMIENTO[m.tipo]}`}
                    >
                      {TIPO_MOVIMIENTO_LABEL[m.tipo]}
                    </span>
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2.5 text-right font-bold ${
                      m.cantidad > 0 ? "text-verde" : "text-rojo"
                    }`}
                  >
                    {m.cantidad > 0 ? "+" : "−"}
                    {formatCantidad(Math.abs(m.cantidad))}{" "}
                    <span className="font-semibold text-neutro">{unidad}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    {m.costo_unit !== null ? formatCOP(m.costo_unit) : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-neutro">{m.nota ?? "—"}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-[13px] text-neutro"
                  >
                    Sin movimientos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
