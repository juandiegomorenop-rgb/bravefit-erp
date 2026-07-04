import Link from "next/link";
import { notFound } from "next/navigation";
import { getOpsRepository } from "@/lib/data/ops";
import {
  formatCOP,
  formatFecha,
  formatFechaCorta,
  formatFechaHora,
} from "@/lib/formato";
import {
  parseFechaLocal,
  progresoEntrega,
  semaforo,
  totalOp,
} from "@/lib/ops-logic";
import {
  BadgeEsperandoProveedor,
  BadgeGarantia,
  BadgeInstalacion,
  BadgeOrigen,
  PillEntrega,
} from "../badges";
import { BotonImprimir } from "./BotonImprimir";
import { ObservacionesOp } from "./ObservacionesOp";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const detalle = await getOpsRepository().obtenerOp(id);
  return { title: detalle ? `${detalle.op.numero} · Detalle` : "O.P." };
}

/** Detalle completo de la O.P. — server component (solo lectura) con
 *  islas cliente para observaciones e impresión. */
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const repo = getOpsRepository();
  const [detalle, etapas] = await Promise.all([
    repo.obtenerOp(id),
    repo.listarEtapas(),
  ]);
  if (!detalle) notFound();

  const { op, cliente, ciudad, origen, items, historial, despachos, observaciones, garantias } =
    detalle;
  const sem = semaforo(op.fecha_entrega_pactada, op.fecha_entregada);
  const total = totalOp(items);
  const progreso = progresoEntrega(items);
  const ordenActual = detalle.etapa.orden;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 print:max-w-none print:p-0">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/produccion/ordenes"
            className="no-print text-[12.5px] font-semibold text-dorado-oscuro hover:underline"
          >
            ← Volver a Órdenes de pedido
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] font-bold leading-tight text-carbon">
              {op.numero}
            </h1>
            <BadgeOrigen origen={origen} />
            <PillEntrega
              fecha_entrega_pactada={op.fecha_entrega_pactada}
              fecha_entregada={op.fecha_entregada}
              semaforo={sem}
            />
            {op.requiere_instalacion && <BadgeInstalacion />}
            {op.esperando_proveedor && <BadgeEsperandoProveedor />}
            {op.segmento && (
              <span className="rounded-pill bg-neutro-bg px-2.5 py-0.5 text-[11px] font-bold text-neutro">
                {op.segmento}
              </span>
            )}
          </div>
        </div>
        <BotonImprimir />
      </div>

      {/* Stepper de etapas */}
      <div className="mt-5 rounded-card border border-borde bg-card px-6 py-5">
        <div className="flex flex-wrap justify-between gap-3">
          {etapas.map((e) => {
            const hecha = e.orden < ordenActual;
            const actual = e.orden === ordenActual;
            return (
              <div
                key={e.id}
                className="flex min-w-[90px] flex-1 flex-col items-center gap-2"
              >
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold ${
                    actual
                      ? "bg-carbon text-white ring-2 ring-dorado"
                      : hecha
                        ? "bg-dorado text-white"
                        : "bg-neutro-bg text-neutro"
                  }`}
                >
                  {hecha ? "✓" : "●"}
                </div>
                <div
                  className={`text-center text-[11.5px] tracking-[.5px] ${
                    actual
                      ? "font-bold text-carbon"
                      : hecha
                        ? "font-semibold text-dorado-oscuro"
                        : "text-neutro"
                  }`}
                >
                  {e.nombre}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Garantías asociadas (prioridad ambulancia) */}
      {garantias.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {garantias.map((g) => (
            <div
              key={g.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-semaforo-rojo/40 bg-rojo-bg px-5 py-3.5"
            >
              <BadgeGarantia grande />
              <b className="text-[13.5px]">{g.numero}</b>
              <span className="text-[13px] text-carbon">{g.problema}</span>
              <span className="ml-auto text-[12px] text-rojo">
                Abierta el {formatFechaCorta(new Date(g.abierta_en))} ·{" "}
                {g.recogida === "bravefit_recoge"
                  ? "Bravefit recoge"
                  : g.recogida === "cliente_envia"
                    ? "Cliente envía"
                    : "Recogida por definir"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Columna principal */}
        <div className="flex flex-col gap-4">
          {/* Ítems */}
          <div className="overflow-hidden rounded-card border border-borde bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f0efec] text-[11.5px] font-semibold tracking-[.4px] text-neutro">
                    <th className="px-5 py-3 font-semibold">PRODUCTO</th>
                    <th className="px-3 py-3 text-right font-semibold">CANT.</th>
                    <th className="px-3 py-3 text-right font-semibold">ENTREGADO</th>
                    <th className="px-3 py-3 text-right font-semibold">PRECIO UNIT.</th>
                    <th className="px-5 py-3 text-right font-semibold">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-[#f6f5f2] last:border-b-0">
                      <td className="px-5 py-3">
                        <b>{it.producto.nombre}</b>
                        <div className="text-[11.5px] text-neutro">
                          {it.producto.sku}
                          {it.color ? ` · ${it.color}` : ""}
                          {it.alto_override_cm ? ` · alto ${it.alto_override_cm} cm` : ""}
                          {it.fondo_override_cm ? ` · fondo ${it.fondo_override_cm} cm` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">{it.cantidad}</td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`font-bold ${
                            it.cantidad_entregada >= it.cantidad
                              ? "text-verde"
                              : it.cantidad_entregada > 0
                                ? "text-dorado-oscuro"
                                : "text-neutro"
                          }`}
                        >
                          {it.cantidad_entregada}/{it.cantidad}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-neutro">
                        {formatCOP(it.precio_unit)}
                      </td>
                      <td className="px-5 py-3 text-right font-bold">
                        {formatCOP(it.cantidad * it.precio_unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between bg-dorado-suave px-5 py-3.5 text-[14px]">
              <b>
                Total O.P.{" "}
                <span className="ml-2 rounded-pill bg-card px-2.5 py-0.5 text-[11.5px] font-bold text-neutro">
                  {progreso}% entregado
                </span>
              </b>
              <b className="text-dorado-oscuro">{formatCOP(total)}</b>
            </div>
          </div>

          {/* Despachos */}
          <div className="rounded-card border border-borde bg-card px-5 py-4">
            <h2 className="text-[14px] font-bold">Despachos</h2>
            {despachos.length === 0 ? (
              <p className="mt-2 text-[13px] text-neutro">
                Sin despachos registrados todavía.
              </p>
            ) : (
              <div className="mt-2 flex flex-col">
                {despachos.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[#f6f5f2] py-2.5 text-[13px] last:border-b-0"
                  >
                    <span className="rounded-pill bg-verde-bg px-2 py-0.5 text-[11px] font-bold text-verde">
                      {d.cantidad} und
                    </span>
                    <b>{d.item.producto.nombre}</b>
                    {d.nota && <span className="text-neutro">· {d.nota}</span>}
                    <span className="ml-auto text-[12px] text-neutro">
                      {formatFechaHora(new Date(d.en))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Línea de tiempo de etapas */}
          <div className="rounded-card border border-borde bg-card px-5 py-4">
            <h2 className="text-[14px] font-bold">Historial de etapas</h2>
            <ol className="mt-3 flex flex-col">
              {[...historial].reverse().map((h, i) => (
                <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < historial.length - 1 && (
                    <span className="absolute left-[7px] top-5 h-full w-px bg-borde" />
                  )}
                  <span
                    className={`mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${
                      i === 0
                        ? "border-dorado bg-dorado"
                        : "border-gris-claro bg-card"
                    }`}
                  />
                  <div className="flex flex-1 flex-wrap items-baseline gap-x-3">
                    <b className="text-[13px]">{h.etapa.nombre}</b>
                    {h.nota && (
                      <span className="text-[12.5px] text-neutro">{h.nota}</span>
                    )}
                    <span className="ml-auto text-[12px] text-neutro">
                      {formatFechaHora(new Date(h.en))}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Observaciones (isla cliente con formulario) */}
          <ObservacionesOp opId={op.id} iniciales={observaciones} />
        </div>

        {/* Columna lateral */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2.5 rounded-card border border-borde bg-card px-5 py-4 text-[13px]">
            <h2 className="text-[14px] font-bold">Cliente</h2>
            <Dato label="Nombre" valor={cliente.nombre} />
            <Dato
              label={cliente.tipo === "empresa" ? "NIT" : "Cédula"}
              valor={cliente.nit_cedula ?? "—"}
            />
            <Dato
              label="Ciudad"
              valor={ciudad ? `${ciudad.nombre}, ${ciudad.departamento}` : "—"}
            />
            <Dato label="Dirección" valor={op.direccion_entrega ?? "—"} />
            <Dato label="Teléfono" valor={cliente.telefono ?? "—"} />
          </div>

          <div className="flex flex-col gap-2.5 rounded-card border border-borde bg-card px-5 py-4 text-[13px]">
            <h2 className="text-[14px] font-bold">Fechas</h2>
            <Dato label="Creada" valor={formatFecha(new Date(op.creado_en))} />
            <Dato
              label="Entrega pactada"
              valor={
                op.fecha_entrega_pactada
                  ? formatFecha(parseFechaLocal(op.fecha_entrega_pactada))
                  : "Sin fecha"
              }
            />
            <Dato
              label="Entregada"
              valor={
                op.fecha_entregada
                  ? formatFecha(parseFechaLocal(op.fecha_entregada))
                  : "Pendiente"
              }
            />
            {op.mp_descontada_en && (
              <Dato
                label="MP descontada"
                valor={formatFechaCorta(new Date(op.mp_descontada_en))}
              />
            )}
          </div>

          {/* Pagos: placeholder hasta la integración con Siigo */}
          <div className="rounded-card border border-aviso-borde bg-aviso px-5 py-4 text-[13px] text-aviso-texto">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold">Pagos · ¿Debe saldo?</h2>
              <span className="rounded-pill bg-card px-2 py-0.5 text-[10px] font-bold uppercase">
                Placeholder
              </span>
            </div>
            <p className="mt-2 leading-relaxed">
              La consulta de cartera (anticipo 60% / saldo 40% antes de
              despachar) se conecta con Siigo en la fase 2. Aquí se mostrará si
              la O.P. tiene saldo pendiente antes de autorizar el despacho.
            </p>
          </div>

          {op.notas && (
            <div className="rounded-card border border-borde bg-card px-5 py-4 text-[13px]">
              <h2 className="text-[14px] font-bold">Notas</h2>
              <p className="mt-2 leading-relaxed text-neutro">{op.notas}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-neutro">{label}</span>
      <b className="text-right">{valor}</b>
    </div>
  );
}
