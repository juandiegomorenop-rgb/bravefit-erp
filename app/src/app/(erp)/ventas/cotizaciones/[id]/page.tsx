import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonImprimir } from "@/app/(erp)/produccion/ordenes/[id]/BotonImprimir";
import { ANTICIPO_PP } from "@/lib/cotizacion-logic";
import { getCotizacionesRepository } from "@/lib/data/crm-cotizaciones";
import { formatCOP, formatFecha, formatFechaCorta } from "@/lib/formato";
import { parseFechaLocal } from "@/lib/ops-logic";
import { BadgeEstadoCotizacion } from "../badges";

export const metadata = { title: "Cotización" };

/**
 * Detalle de cotización — el documento comercial de Bravefit.
 * En pantalla: contexto completo (estado, CRM, no_facturar).
 * En impresión (@media print): SOLO el documento, formato A4 con la
 * plantilla del Planner (logo, NIT, condiciones PP/PC, validez 15 días).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const det = await getCotizacionesRepository().obtener(id);
  if (!det) notFound();

  const { cotizacion: cot, cliente, ciudad, vendedor, estado, items, totales } = det;
  const hayPP = totales.totalPP > 0;
  const hayPC = totales.totalPC > 0;

  return (
    <div className="mx-auto max-w-[900px]">
      {/* Barra de contexto — no se imprime */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">
            <Link href="/ventas/cotizaciones" className="hover:underline">
              Ventas / Cotizaciones
            </Link>{" "}
            / {cot.numero}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-extrabold tracking-tight">
              {cot.numero}
            </h1>
            <BadgeEstadoCotizacion nombre={estado.nombre} vencida={det.vencida} />
            <span className="rounded-pill bg-neutro-bg px-2.5 py-0.5 text-[11px] font-bold text-neutro">
              {cot.segmento}
            </span>
            {cot.no_facturar && (
              <span className="rounded-pill bg-aviso px-2.5 py-0.5 text-[11px] font-bold text-aviso-texto ring-1 ring-aviso-borde">
                No facturar (no va a Siigo)
              </span>
            )}
            <span className="rounded-pill bg-neutro-bg px-2.5 py-0.5 text-[11px] font-bold capitalize text-neutro">
              Origen: {cot.origen}
            </span>
          </div>
        </div>
        <BotonImprimir />
      </div>

      {/* ===================== DOCUMENTO ===================== */}
      <div className="rounded-card border border-borde bg-card p-7 print:rounded-none print:border-0 print:p-0">
        {/* Encabezado empresa */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-carbon pb-5">
          <div>
            <Image
              src="/brand/logo-carbon.png"
              alt="Bravefit"
              width={170}
              height={44}
              className="h-auto w-[150px]"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-neutro">
              Bravefit · NIT 901.919.917-0
              <br />
              Calle 25A # 43B 267, Medellín
              <br />
              Tel 310 524 5471 · info@bravefit.co · www.bravefit.co
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-bold uppercase tracking-wider text-neutro">
              Cotización
            </p>
            <p className="text-[24px] font-extrabold tracking-tight">
              {cot.numero}
            </p>
            <p className="mt-1 text-[12px] text-neutro">
              Fecha: {formatFecha(new Date(cot.creado_en))}
              <br />
              Válida hasta:{" "}
              <b className={det.vencida ? "text-ambar" : "text-carbon"}>
                {formatFecha(parseFechaLocal(cot.valida_hasta))}
              </b>
            </p>
          </div>
        </div>

        {/* Cliente + vendedor */}
        <div className="grid gap-4 border-b border-borde py-5 sm:grid-cols-2">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
              Cliente
            </p>
            <p className="mt-1 text-[14px] font-bold">{cliente.nombre}</p>
            <p className="text-[12px] leading-relaxed text-neutro">
              {cliente.nit_cedula && <>NIT/CC {cliente.nit_cedula}<br /></>}
              {cliente.direccion}
              {ciudad && <> · {ciudad.nombre}</>}
              <br />
              {cliente.telefono}
              {cliente.email && <> · {cliente.email}</>}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
              Atendido por
            </p>
            <p className="mt-1 text-[13px] font-semibold">{vendedor.nombre}</p>
            <p className="text-[12px] text-neutro">{vendedor.email}</p>
          </div>
        </div>

        {/* Ítems */}
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-borde text-left text-[10.5px] uppercase tracking-wider text-neutro">
              <th className="py-2.5 pr-3 font-bold">Ítem</th>
              <th className="px-3 py-2.5 text-center font-bold">Cant.</th>
              <th className="px-3 py-2.5 text-right font-bold">Precio unit.</th>
              <th className="py-2.5 pl-3 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const detalles: string[] = [];
              if (it.alto_override_cm) detalles.push(`Alto ${it.alto_override_cm} cm`);
              if (it.fondo_override_cm) detalles.push(`Fondo ${it.fondo_override_cm} cm`);
              if (it.color) detalles.push(`Color ${it.color}`);
              for (const r of it.recargos) detalles.push(r.nombre);
              if (!it.aplica_iva) detalles.push("Excluido de IVA");
              return (
                <tr key={it.id} className="border-b border-borde last:border-0">
                  <td className="py-3 pr-3">
                    <span className="font-semibold">
                      {it.producto?.nombre ?? it.descripcion}
                    </span>
                    {it.producto && (
                      <span className="ml-2 text-[10.5px] text-neutro">
                        {it.producto.sku}
                      </span>
                    )}
                    {detalles.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-neutro">
                        {detalles.join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">{it.cantidad}</td>
                  <td className="px-3 py-3 text-right">{formatCOP(it.precio_unit)}</td>
                  <td className="py-3 pl-3 text-right font-semibold">
                    {formatCOP(it.cantidad * it.precio_unit)}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-neutro">
                  Esta cotización aún no tiene ítems.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totales */}
        {items.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-[320px] text-[13px]">
              {totales.descuentoMonto > 0 && (
                <>
                  <div className="flex justify-between py-1 text-neutro">
                    <span>Total antes de descuento</span>
                    <span>{formatCOP(totales.bruto)}</span>
                  </div>
                  <div className="flex justify-between py-1 font-semibold text-verde">
                    <span>Descuento pago anticipado ({totales.descuentoPct}%)</span>
                    <span>-{formatCOP(totales.descuentoMonto)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between py-1 text-neutro">
                <span>Subtotal</span>
                <span>{formatCOP(totales.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-neutro">
                <span>IVA (19%)</span>
                <span>{formatCOP(totales.iva)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t-2 border-carbon py-2 text-[16px] font-extrabold">
                <span>Total</span>
                <span>{formatCOP(totales.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Términos de pago: UNA factura, pagos según grupo PP/PC */}
        {items.length > 0 && (
          <div className="mt-5 rounded-[10px] bg-sutil p-4 print:border print:border-borde">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
              Forma de pago
            </p>
            <div className="mt-2 grid gap-3 text-[12.5px] sm:grid-cols-2">
              <div>
                {cot.pago_anticipado_completo ? (
                  <p>
                    <b>100% anticipado</b> — descuento del {totales.descuentoPct}%
                    aplicado.
                  </p>
                ) : (
                  <ul className="list-disc space-y-1 pl-4">
                    {hayPP && (
                      <li>
                        <b>Fabricación propia</b> ({formatCOP(totales.totalPP)}):{" "}
                        {ANTICIPO_PP * 100}% de anticipo y saldo antes de la entrega.
                      </li>
                    )}
                    {hayPC && (
                      <li>
                        <b>Producto comercializado</b> ({formatCOP(totales.totalPC)}):
                        100% anticipado · entrega 3–7 días hábiles.
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div className="rounded-[10px] bg-dorado-suave p-3 text-right sm:self-start">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-dorado-oscuro">
                  Pago inicial para confirmar
                </p>
                <p className="text-[20px] font-extrabold text-dorado-oscuro">
                  {formatCOP(totales.pagoInicial)}
                </p>
                {totales.saldo > 0 && (
                  <p className="text-[11.5px] text-neutro">
                    Saldo antes de entrega: <b>{formatCOP(totales.saldo)}</b>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notas + condiciones */}
        {cot.notas && (
          <p className="mt-4 text-[12px] text-neutro">
            <b className="text-carbon">Notas:</b> {cot.notas}
          </p>
        )}
        <p className="mt-4 border-t border-borde pt-3 text-[10.5px] leading-relaxed text-neutro">
          Precios en pesos colombianos (COP) con IVA incluido donde aplica.
          Cotización válida hasta el{" "}
          {formatFechaCorta(parseFechaLocal(cot.valida_hasta))} (15 días). La
          producción inicia al confirmarse el pago inicial. Una venta genera una
          única factura; el esquema 60/40 corresponde a dos pagos de la misma
          factura.
        </p>
      </div>
    </div>
  );
}
