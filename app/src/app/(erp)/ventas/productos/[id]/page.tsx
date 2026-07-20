import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CATEGORIA_COMPONENTE_LABEL,
  CLASIFICACION_DESCRIPCION,
} from "@/lib/data/productos";
import { getProductosRepository } from "@/lib/data/productos-server";
import { SubirFotoProducto } from "./SubirFotoProducto";
import { formatCOP, formatFecha } from "@/lib/formato";
import {
  BadgeClasificacion,
  BadgeEsRack,
  BadgeOrigenProducto,
  FotoProducto,
} from "../badges";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params;
  const detalle = await getProductosRepository().obtener(id);
  return {
    title: detalle ? `${detalle.producto.nombre} · Producto` : "Producto",
  };
}

const EJE_LABEL: Record<string, string> = { alto: "Alto", fondo: "Fondo" };

/** Ficha completa del producto — server component (solo lectura). */
export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const detalle = await getProductosRepository().obtener(id);
  if (!detalle) notFound();

  const { producto: p, categoria, dimensiones, componentes } = detalle;

  const dimsBase = [
    p.ancho_cm ? `Ancho ${p.ancho_cm} cm` : null,
    p.profundidad_cm ? `Fondo ${p.profundidad_cm} cm` : null,
    p.alto_cm ? `Alto ${p.alto_cm} cm` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/ventas/productos"
            className="text-[12.5px] font-semibold text-dorado-oscuro hover:underline"
          >
            ← Volver a Productos
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] font-bold leading-tight text-carbon">
              {p.nombre}
            </h1>
            <BadgeClasificacion clasificacion={p.clasificacion} larga />
            <BadgeOrigenProducto origen={p.origen} />
            {p.es_rack && <BadgeEsRack />}
          </div>
          <p className="mt-1 text-[13px] text-neutro">
            {categoria.nombre} · SKU <b className="text-carbon">{p.sku}</b>
            {p.sku_siigo ? (
              <>
                {" "}
                · Siigo <b className="text-carbon">{p.sku_siigo}</b>
              </>
            ) : (
              <span className="italic text-neutro/60"> — sin SKU Siigo</span>
            )}
          </p>
        </div>
        <Link
          href={`/ventas/cotizaciones?q=${encodeURIComponent(p.sku)}`}
          className="rounded-input bg-carbon px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#414141]"
        >
          Ver en cotizaciones
        </Link>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[1fr_1.5fr]">
        {/* Foto grande + subir/reemplazar sin deploy */}
        <div>
          <div className="overflow-hidden rounded-card border border-borde bg-card">
            <FotoProducto producto={p} clase="aspect-square w-full" grande />
          </div>
          <SubirFotoProducto productoId={p.id} tieneFoto={!!p.imagen_url} />
        </div>

        {/* Ficha */}
        <div className="flex flex-col gap-4">
          {/* Precio + clasificación explicada */}
          <div className="rounded-card border border-borde bg-card px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] text-neutro">Precio de lista</span>
              <b className="text-[26px] font-extrabold tracking-tight text-dorado-oscuro">
                {formatCOP(p.precio_lista)}
                <span className="ml-2 text-[11px] font-semibold text-neutro">
                  IVA incluido (19%)
                </span>
              </b>
            </div>
            <div className="mt-3 rounded-input bg-sutil px-3.5 py-2.5 text-[12.5px] leading-relaxed text-neutro">
              <b className="text-carbon">{p.clasificacion}:</b>{" "}
              {CLASIFICACION_DESCRIPCION[p.clasificacion]}
            </div>
          </div>

          {/* Datos generales */}
          <div className="flex flex-col gap-2.5 rounded-card border border-borde bg-card px-5 py-4 text-[13px]">
            <h2 className="text-[14px] font-bold">Ficha técnica</h2>
            <Dato label="Categoría" valor={categoria.nombre} />
            <Dato
              label="Origen"
              valor={p.origen === "propio" ? "Fabricación propia" : "Comercializado"}
            />
            <Dato
              label="Dimensiones base"
              valor={dimsBase.length > 0 ? dimsBase.join(" · ") : "—"}
            />
            <Dato label="Peso" valor={p.peso_kg ? `${p.peso_kg} kg` : "—"} />
            <Dato
              label="Costo estándar"
              valor={p.costo_estandar ? formatCOP(p.costo_estandar) : "—"}
            />
            <Dato
              label="Shopify"
              valor={p.shopify_product_id ? "Vinculado" : "Sin vincular"}
            />
            <Dato label="Creado" valor={formatFecha(new Date(p.creado_en))} />
            {p.descripcion && (
              <p className="mt-1 leading-relaxed text-neutro">{p.descripcion}</p>
            )}
          </div>

          {/* Colores disponibles */}
          <div className="rounded-card border border-borde bg-card px-5 py-4">
            <h2 className="text-[14px] font-bold">Colores disponibles</h2>
            {p.colores_disponibles.length === 0 ? (
              <p className="mt-2 text-[13px] text-neutro">
                Sin variantes de color configuradas.
              </p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {p.colores_disponibles.map((c) => (
                  <span
                    key={c}
                    className={`rounded-pill border px-3 py-1 text-[12px] font-semibold ${
                      c === p.color_default
                        ? "border-dorado bg-dorado-suave text-dorado-oscuro"
                        : "border-borde bg-sutil text-carbon"
                    }`}
                  >
                    {c}
                    {c === p.color_default && " · estándar"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dimensiones variables (planner) */}
      {dimensiones.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-card border border-borde bg-card">
          <div className="px-5 pb-1 pt-4">
            <h2 className="text-[14px] font-bold">Dimensiones variables</h2>
            <p className="mt-0.5 text-[12.5px] text-neutro">
              Rango pedible en cotización con sobreprecio por cm adicional
              sobre la medida estándar.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f0efec] text-[11.5px] font-semibold tracking-[.4px] text-neutro">
                  <th className="px-5 py-3 font-semibold">EJE</th>
                  <th className="px-3 py-3 text-right font-semibold">MÍN.</th>
                  <th className="px-3 py-3 text-right font-semibold">MÁX.</th>
                  <th className="px-3 py-3 text-right font-semibold">ESTÁNDAR</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    $ POR CM EXTRA
                  </th>
                </tr>
              </thead>
              <tbody>
                {dimensiones.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[#f6f5f2] last:border-b-0"
                  >
                    <td className="px-5 py-3 font-bold">
                      {EJE_LABEL[d.eje] ?? d.eje}
                    </td>
                    <td className="px-3 py-3 text-right">{d.min_cm} cm</td>
                    <td className="px-3 py-3 text-right">{d.max_cm} cm</td>
                    <td className="px-3 py-3 text-right font-bold">
                      {d.default_cm} cm
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-dorado-oscuro">
                      {formatCOP(d.precio_por_cm_extra)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOM / despiece */}
      {componentes.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-card border border-borde bg-card">
          <div className="px-5 pb-1 pt-4">
            <h2 className="text-[14px] font-bold">
              Despiece (BOM)
              <span className="ml-2 rounded-pill bg-neutro-bg px-2.5 py-0.5 text-[11px] font-bold text-neutro">
                {componentes.length} componentes
              </span>
            </h2>
            <p className="mt-0.5 text-[12.5px] text-neutro">
              Estructura heredada del planner. Los componentes marcados «solo
              producción» no aparecen en documentos del cliente.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f0efec] text-[11.5px] font-semibold tracking-[.4px] text-neutro">
                  <th className="px-5 py-3 font-semibold">COMPONENTE</th>
                  <th className="px-3 py-3 font-semibold">CATEGORÍA</th>
                  <th className="px-3 py-3 text-right font-semibold">CANT.</th>
                  <th className="px-3 py-3 text-right font-semibold">LONGITUD</th>
                  <th className="px-5 py-3 font-semibold">COLOR</th>
                </tr>
              </thead>
              <tbody>
                {componentes.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-[#f6f5f2] last:border-b-0 ${
                      c.visible_cliente ? "" : "bg-sutil"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <b>{c.descripcion}</b>
                      {!c.visible_cliente && (
                        <span className="ml-2 rounded-pill bg-neutro-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutro">
                          Solo producción
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-neutro">
                      {CATEGORIA_COMPONENTE_LABEL[c.categoria] ?? c.categoria}
                    </td>
                    <td className="px-3 py-3 text-right font-bold">
                      {c.cantidad}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {c.longitud_cm ? `${c.longitud_cm} cm` : "—"}
                    </td>
                    <td className="px-5 py-3 text-neutro">
                      {c.color ??
                        (c.color_sigue_rack ? "Sigue el color del rack" : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
