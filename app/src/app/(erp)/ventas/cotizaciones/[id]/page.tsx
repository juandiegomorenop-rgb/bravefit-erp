import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonImprimir } from "@/app/(erp)/produccion/ordenes/[id]/BotonImprimir";
import {
  listaProductosGrupo,
  notaPagoInicial,
  totalLinea,
  totalLineaLista,
  type CotizacionItemConProducto,
} from "@/lib/cotizacion-logic";
import { getCotizacionesRepository } from "@/lib/data/crm-cotizaciones";
import { CATEGORIAS } from "@/lib/data/ops";
import { formatCOP, formatFecha } from "@/lib/formato";
import { parseFechaLocal } from "@/lib/ops-logic";
import { BadgeEstadoCotizacion } from "../badges";

export const metadata = { title: "Cotización" };

/**
 * Detalle de cotización — ESPEJO de la plantilla oficial Bravefit
 * (skill cotizaciones-bravefit / docs/cotizacion-template del planner):
 * productos con foto agrupados por categoría, precio de lista tachado →
 * columna % DESC → subtotal, tiempo de entrega, PAGO INICIAL con nota
 * dinámica, bullets 60%/100% que RELACIONAN los productos de cada grupo,
 * y cuenta bancaria. En @media print sale el documento limpio A4.
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

  // Agrupar por categoría (los ítems libres/transporte van a "Logística")
  const grupos: { nombre: string; items: CotizacionItemConProducto[] }[] = [];
  for (const cat of [...CATEGORIAS].sort((a, b) => a.orden - b.orden)) {
    const del = items.filter((i) => i.producto?.categoria_id === cat.id);
    if (del.length) grupos.push({ nombre: cat.nombre, items: del });
  }
  const libres = items.filter((i) => !i.producto);
  if (libres.length) grupos.push({ nombre: "Logística", items: libres });

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
            <h1 className="text-[26px] font-extrabold tracking-tight">{cot.numero}</h1>
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
            <span className="text-[11.5px] text-neutro">
              Vendedor: {vendedor.nombre}
            </span>
          </div>
        </div>
        <BotonImprimir />
      </div>

      {/* ===================== DOCUMENTO (plantilla Bravefit) ===================== */}
      <div className="rounded-card border border-borde bg-card p-8 print:rounded-none print:border-0 print:p-0">
        {/* Header: logo | COTIZACIÓN + número + fecha */}
        <header className="flex items-start justify-between border-b border-[#E5E5E5] pb-4">
          <Image
            src="/brand/logo-carbon.png"
            alt="Bravefit"
            width={170}
            height={44}
            className="h-auto w-[150px]"
          />
          <div className="text-right">
            <h2 className="text-[22px] font-bold tracking-[2px]">COTIZACIÓN</h2>
            <p className="text-[12px] text-neutro">{cot.numero}</p>
            <p className="text-[12px] text-neutro">
              {formatFecha(new Date(cot.creado_en))}
            </p>
          </div>
        </header>

        {/* EMISOR / CLIENTE */}
        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold tracking-[1px] text-neutro">EMISOR</p>
            <p className="mt-1 text-[14px] font-bold">Grupo Bravefit SAS</p>
            <p className="text-[12px] leading-relaxed text-neutro">
              NIT 901.919.917-2
              <br />
              Calle 25A # 43B 267, Medellín
              <br />
              Tel: 310 524 5471
              <br />
              info@bravefit.co · www.bravefit.co
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[1px] text-neutro">CLIENTE</p>
            <p className="mt-1 text-[14px] font-bold">{cliente.nombre}</p>
            <p className="text-[12px] leading-relaxed text-neutro">
              {cliente.nit_cedula && <>NIT/CC {cliente.nit_cedula}<br /></>}
              {cliente.direccion && <>{cliente.direccion}<br /></>}
              {ciudad?.nombre}
              {cliente.telefono && <> · {cliente.telefono}</>}
              {cliente.email && (
                <>
                  <br />
                  {cliente.email}
                </>
              )}
            </p>
            {cot.notas && (
              <p className="mt-1.5 text-[11.5px] italic leading-snug text-neutro">
                {cot.notas}
              </p>
            )}
          </div>
        </section>

        {/* PRODUCTOS */}
        <h3 className="mt-7 text-[13px] font-bold tracking-[1px]">PRODUCTOS</h3>
        <div className="mt-2 flex border-b-2 border-carbon pb-1.5 text-[10px] font-bold tracking-[0.5px] text-neutro">
          <div className="w-[76px]" />
          <div className="flex-1 pr-2">PRODUCTO</div>
          <div className="w-[44px] text-center">CANT</div>
          <div className="w-[96px] text-right">PRECIO</div>
          <div className="w-[56px] text-right">% DESC</div>
          <div className="w-[104px] text-right">SUBTOTAL</div>
        </div>

        {grupos.map((g) => {
          const subtotalCat = g.items.reduce((a, i) => a + totalLinea(i), 0);
          return (
            <div key={g.nombre}>
              <div className="mt-1.5 bg-carbon px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[1px] text-white">
                {g.nombre}
              </div>
              {g.items.map((it) => {
                const conDesc = it.descuento_pct > 0;
                const sub: string[] = [];
                if (it.producto) sub.push(`SKU ${it.producto.sku}`);
                if (it.alto_override_cm) sub.push(`Alto ${it.alto_override_cm} cm`);
                if (it.fondo_override_cm) sub.push(`Fondo ${it.fondo_override_cm} cm`);
                if (it.color) sub.push(`Color ${it.color}`);
                for (const r of it.recargos) sub.push(r.nombre);
                if (!it.aplica_iva) sub.push("Excluido de IVA");
                return (
                  <div
                    key={it.id}
                    className="flex items-center border-b border-[#E5E5E5] py-2.5"
                  >
                    <div className="w-[76px]">
                      {it.producto?.imagen_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.producto.imagen_url}
                          alt={it.producto.nombre}
                          className="h-[64px] w-[64px] object-contain"
                        />
                      )}
                    </div>
                    <div className="flex-1 pr-2">
                      <p className="text-[13px] font-bold leading-tight">
                        {it.producto?.nombre ?? it.descripcion}
                      </p>
                      {sub.length > 0 && (
                        <p className="mt-0.5 text-[10.5px] leading-relaxed text-neutro">
                          {sub.join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="w-[44px] text-center text-[13px] font-bold">
                      {it.cantidad}
                    </div>
                    <div className="w-[96px] text-right">
                      {conDesc ? (
                        <span className="text-[11.5px] text-[#9CA3AF] line-through">
                          {formatCOP(it.precio_unit)}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-neutro">
                          {formatCOP(it.precio_unit)}
                        </span>
                      )}
                    </div>
                    <div className="w-[56px] text-right">
                      {conDesc ? (
                        <span className="text-[11.5px] font-bold text-dorado-oscuro">
                          -{it.descuento_pct}%
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-[#C7C7C7]">—</span>
                      )}
                    </div>
                    <div className="w-[104px] text-right text-[13px] font-bold">
                      {formatCOP(totalLinea(it))}
                    </div>
                  </div>
                );
              })}
              {grupos.length > 1 && (
                <div className="flex justify-end gap-4 border-b border-[#E5E5E5] py-1.5 pr-0">
                  <span className="text-[10.5px] uppercase tracking-[0.5px] text-neutro">
                    Subtotal {g.nombre}
                  </span>
                  <span className="min-w-[104px] text-right text-[12px] font-bold">
                    {formatCOP(subtotalCat)}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Totales */}
        <div className="ml-auto mt-4 w-full max-w-[380px]">
          {totales.descuentoMonto > 0 && (
            <>
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-neutro">Subtotal productos</span>
                <span className="font-bold">{formatCOP(totales.bruto)}</span>
              </div>
              <div className="flex justify-between py-1 text-[13px]">
                <span className="text-neutro">
                  Descuento
                  {totales.descuentoGlobal > 0 &&
                    ` (pago anticipado ${totales.descuentoPct}%)`}
                </span>
                <span className="font-bold text-dorado-oscuro">
                  - {formatCOP(totales.descuentoMonto)}
                </span>
              </div>
              <div className="my-1 border-t border-[#E5E5E5]" />
            </>
          )}
          <div className="flex justify-between py-1 text-[13px]">
            <span className="text-neutro">Subtotal (sin IVA)</span>
            <span className="font-bold">{formatCOP(totales.subtotal)}</span>
          </div>
          <div className="flex justify-between py-1 text-[13px]">
            <span className="text-neutro">IVA 19%</span>
            <span className="font-bold">{formatCOP(totales.iva)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between bg-sutil px-3 py-2.5">
            <span className="text-[15px] font-bold">Total</span>
            <span className="text-[19px] font-bold text-dorado-oscuro">
              {formatCOP(totales.total)}
            </span>
          </div>
          {cot.tiempo_entrega && (
            <div className="mt-2 flex justify-between gap-4 px-3 text-[12.5px]">
              <span className="text-neutro">
                Tiempo de entrega de productos a fabricar
              </span>
              <span className="whitespace-nowrap font-bold">{cot.tiempo_entrega}</span>
            </div>
          )}
        </div>

        {/* TÉRMINOS DE PAGO */}
        {items.length > 0 && (
          <section className="mt-7 border-t border-[#E5E5E5] pt-5">
            <h3 className="text-[13px] font-bold tracking-[1px]">TÉRMINOS DE PAGO</h3>

            <div className="mt-3 flex items-center justify-between gap-4 rounded-[4px] border border-dorado-oscuro bg-[#FBF6EC] px-4 py-3">
              <div>
                <p className="text-[11.5px] font-bold tracking-[1px]">PAGO INICIAL</p>
                <p className="text-[10.5px] text-neutro">
                  {notaPagoInicial(hayPP, hayPC, cot.pago_anticipado_completo)}
                </p>
              </div>
              <span className="text-[21px] font-bold text-dorado-oscuro">
                {formatCOP(totales.pagoInicial)}
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-[13px] leading-relaxed">
              {cot.pago_anticipado_completo ? (
                <div className="flex">
                  <span className="w-[16px] font-bold text-dorado-oscuro">•</span>
                  <span className="flex-1">
                    Pago del <b>100%</b> anticipado por{" "}
                    <b className="text-dorado-oscuro">{formatCOP(totales.total)}</b>
                    {totales.descuentoGlobal > 0 && (
                      <> — incluye descuento del <b>{totales.descuentoPct}%</b> por pago anticipado</>
                    )}
                    .
                  </span>
                </div>
              ) : (
                <>
                  {hayPP && (
                    <div className="flex">
                      <span className="w-[16px] font-bold text-dorado-oscuro">•</span>
                      <span className="flex-1">
                        Anticipo del <b>60%</b> correspondiente a{" "}
                        <b className="text-dorado-oscuro">
                          {formatCOP(Math.round(totales.totalPP * 0.6))}
                        </b>{" "}
                        de los productos:{" "}
                        <span className="text-neutro">
                          {listaProductosGrupo(items, "PP")}.
                        </span>{" "}
                        Saldo del 40% antes de la entrega.
                      </span>
                    </div>
                  )}
                  {hayPC && (
                    <>
                      <div className="flex">
                        <span className="w-[16px] font-bold text-dorado-oscuro">•</span>
                        <span className="flex-1">
                          Pago del <b>100%</b> correspondiente a{" "}
                          <b className="text-dorado-oscuro">
                            {formatCOP(totales.totalPC)}
                          </b>{" "}
                          de los productos:{" "}
                          <span className="text-neutro">
                            {listaProductosGrupo(items, "PC")}.
                          </span>
                        </span>
                      </div>
                      <p className="ml-[16px] text-[11.5px] text-neutro">
                        Tiempo de entrega de productos comercializados 3 a 7 días
                        hábiles. Validar disponibilidad con su asesor comercial.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="mt-4 border-l-[3px] border-dorado-oscuro bg-sutil px-4 py-3 text-[12px] leading-relaxed">
              <span className="mb-0.5 block text-[10px] font-bold tracking-[1px] text-neutro">
                CUENTA PARA EL PAGO
              </span>
              Bancolombia, cuenta de ahorros <b># 61100004767</b> a nombre de{" "}
              <b>GRUPO BRAVEFIT SAS</b>, NIT 901.919.917-2. También puedes pagar
              con la llave <b>0087792912</b>.
            </div>
          </section>
        )}

        {/* Pie: validez (en el PDF real va como pie de página) */}
        <p className="mt-6 border-t border-[#E5E5E5] pt-3 text-center text-[10px] text-[#9CA3AF]">
          Cotización válida por 15 días desde la fecha de emisión (hasta el{" "}
          {formatFecha(parseFechaLocal(cot.valida_hasta))}) · info@bravefit.co ·
          310 524 5471
        </p>
      </div>
    </div>
  );
}
