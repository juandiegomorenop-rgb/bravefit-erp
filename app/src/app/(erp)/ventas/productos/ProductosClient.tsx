"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  aplicarFiltrosProductos,
  CLASIFICACION_LABEL,
  type CategoriaProducto,
  type FiltrosProductos,
  type ProductoCard,
} from "@/lib/data/productos";
import { formatCOP } from "@/lib/formato";
import type { Producto } from "@/lib/types/db";
import {
  BadgeClasificacion,
  BadgeEsRack,
  BadgeOrigenProducto,
  FotoProducto,
} from "./badges";

interface Props {
  cardsIniciales: ProductoCard[];
  categorias: CategoriaProducto[];
  filtrosIniciales: FiltrosProductos;
}

/** Catálogo maestro: filtros + grid de tarjetas de producto. */
export function ProductosClient({
  cardsIniciales,
  categorias,
  filtrosIniciales,
}: Props) {
  const [filtros, setFiltros] = useState(filtrosIniciales);

  const filtrados = useMemo(
    () => aplicarFiltrosProductos(cardsIniciales, filtros),
    [cardsIniciales, filtros],
  );

  function actualizar(nuevos: FiltrosProductos) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.categoria_id) p.set("cat", String(nuevos.categoria_id));
    if (nuevos.clasificacion) p.set("clasif", nuevos.clasificacion);
    if (nuevos.origen) p.set("origen", nuevos.origen);
    if (nuevos.texto) p.set("q", nuevos.texto);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">Ventas /</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">
            Productos
          </h1>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          defaultValue={filtros.texto}
          onChange={(e) => actualizar({ ...filtros, texto: e.target.value })}
          placeholder="Buscar nombre o SKU…"
          className="w-full max-w-[320px] rounded-input border border-borde bg-card px-3.5 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <select
          aria-label="Filtrar por categoría"
          value={filtros.categoria_id ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              categoria_id: Number(e.target.value) || undefined,
            })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por clasificación"
          value={filtros.clasificacion ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              clasificacion: (e.target.value ||
                undefined) as FiltrosProductos["clasificacion"],
            })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todas las clasificaciones</option>
          {(Object.keys(CLASIFICACION_LABEL) as Producto["clasificacion"][]).map(
            (c) => (
              <option key={c} value={c}>
                {CLASIFICACION_LABEL[c]}
              </option>
            ),
          )}
        </select>
        <select
          aria-label="Filtrar por origen"
          value={filtros.origen ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              origen: (e.target.value || undefined) as FiltrosProductos["origen"],
            })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Propios y comercializados</option>
          <option value="propio">Propio</option>
          <option value="comercializado">Comercializado</option>
        </select>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtrados.length}</b>{" "}
          {filtrados.length === 1 ? "producto" : "productos"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtrados.map(({ producto, categoria }) => (
          <Link
            key={producto.id}
            href={`/ventas/productos/${producto.id}`}
            className="group flex flex-col overflow-hidden rounded-card border border-borde bg-card transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,.08)]"
          >
            <FotoProducto producto={producto} clase="h-[150px] w-full" />
            <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <BadgeClasificacion clasificacion={producto.clasificacion} />
                <BadgeOrigenProducto origen={producto.origen} />
                {producto.es_rack && <BadgeEsRack />}
              </div>
              <p className="text-[14.5px] font-bold leading-snug group-hover:text-dorado-oscuro">
                {producto.nombre}
              </p>
              <p className="text-[11.5px] text-neutro">
                {producto.sku}
                {producto.sku_siigo ? (
                  <> · Siigo {producto.sku_siigo}</>
                ) : (
                  <span className="italic text-neutro/60"> — sin SKU Siigo</span>
                )}
              </p>
              <p className="text-[11.5px] text-neutro">{categoria.nombre}</p>
              <p className="mt-auto pt-1.5 text-[18px] font-extrabold tracking-tight text-carbon">
                {formatCOP(producto.precio_lista)}
                <span className="ml-1.5 text-[10.5px] font-semibold text-neutro">
                  IVA incluido
                </span>
              </p>
            </div>
          </Link>
        ))}
        {filtrados.length === 0 && (
          <div className="col-span-full rounded-card border border-borde bg-card px-4 py-10 text-center text-[13px] text-neutro">
            No hay productos con estos filtros.
          </div>
        )}
      </div>
    </div>
  );
}
