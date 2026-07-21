"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  aplicarFiltrosInventario,
  estadoBuffer,
  UNIDAD_LABEL,
  type CompraMensual,
  type ExistenciaMP,
  type ExistenciaPT,
  type FiltrosInventarioMP,
} from "@/lib/data/inventario";
import { formatCOP } from "@/lib/formato";
import type { TipoMaterial } from "@/lib/types/db";
import { TendenciaCompras } from "./TendenciaCompras";
import { BadgeEstadoBuffer, BarraBuffer, formatCantidad } from "./ui";

interface Props {
  filasMP: ExistenciaMP[];
  filasPT: ExistenciaPT[];
  compras: CompraMensual[];
  tipos: TipoMaterial[];
  filtrosIniciales: FiltrosInventarioMP;
}

/** Inventarios (una sola bodega): KPIs + materia prima + PT + tendencia. */
export function InventariosClient({
  filasMP,
  filasPT,
  compras,
  tipos,
  filtrosIniciales,
}: Props) {
  const [filtros, setFiltros] = useState(filtrosIniciales);

  const filtradas = useMemo(
    () => aplicarFiltrosInventario(filasMP, filtros),
    [filasMP, filtros],
  );

  const kpis = useMemo(() => {
    const bajoBuffer = filasMP.filter(
      (f) =>
        estadoBuffer(f.existencia.cantidad_disponible, f.material) === "reponer",
    ).length;
    const valorTotal = filasMP.reduce(
      (acc, f) =>
        acc + f.existencia.cantidad_disponible * f.material.costo_promedio,
      0,
    );
    return { referencias: filasMP.length, bajoBuffer, valorTotal };
  }, [filasMP]);

  function actualizar(nuevos: FiltrosInventarioMP) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.tipo_material_id) p.set("tipo", String(nuevos.tipo_material_id));
    if (nuevos.texto) p.set("q", nuevos.texto);
    if (nuevos.solo_bajo_buffer) p.set("bajo", "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="mb-4">
        <p className="text-[12.5px] text-neutro">Producción /</p>
        <h1 className="text-[26px] font-extrabold tracking-tight">
          Inventarios
        </h1>
        <p className="mt-0.5 text-[13px] text-neutro">
          Una sola bodega · buffers de reposición por consumo (Simple
          Solutions). Clic en un material para ver su kardex.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Referencias de materia prima
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">
            {kpis.referencias}
          </p>
        </div>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Bajo buffer mínimo
          </p>
          <p
            className={`mt-1 text-[24px] font-extrabold tracking-tight ${
              kpis.bajoBuffer > 0 ? "text-semaforo-rojo" : "text-verde"
            }`}
          >
            {kpis.bajoBuffer}
          </p>
        </div>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Valor inventario MP
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">
            {formatCOP(kpis.valorTotal)}
          </p>
          <p className="text-[11px] text-neutro">
            Σ disponible × costo promedio
          </p>
        </div>
      </div>

      {/* Filtros MP */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          defaultValue={filtros.texto}
          onChange={(e) => actualizar({ ...filtros, texto: e.target.value })}
          placeholder="Buscar material…"
          className="w-full max-w-[300px] rounded-input border border-borde bg-card px-3.5 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <select
          aria-label="Filtrar por tipo de material"
          value={filtros.tipo_material_id ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              tipo_material_id: Number(e.target.value) || undefined,
            })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={filtros.solo_bajo_buffer ?? false}
            onChange={(e) =>
              actualizar({ ...filtros, solo_bajo_buffer: e.target.checked })
            }
            className="h-4 w-4 accent-[#be9a2e]"
          />
          Solo bajo buffer
        </label>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtradas.length}</b>{" "}
          {filtradas.length === 1 ? "referencia" : "referencias"}
        </span>
      </div>

      {/* Tabla materia prima */}
      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[960px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde bg-sutil text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-2.5 font-semibold">Material</th>
              <th className="px-3 py-2.5 font-semibold">Tipo</th>
              <th className="px-3 py-2.5 font-semibold">Und</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Disponible
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Reservada
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Costo prom.
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Buffer min–max
              </th>
              <th className="w-[150px] px-3 py-2.5 font-semibold">Nivel</th>
              <th className="px-4 py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(({ existencia, material, tipo }) => {
              const estado = estadoBuffer(
                existencia.cantidad_disponible,
                material,
              );
              return (
                <tr
                  key={existencia.id}
                  className="border-b border-[#f6f5f2] last:border-b-0 hover:bg-sutil"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/produccion/inventarios/${material.id}`}
                      className="font-semibold hover:text-dorado-oscuro hover:underline"
                    >
                      {material.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-neutro">{tipo.nombre}</td>
                  <td className="px-3 py-2.5 text-neutro">
                    {UNIDAD_LABEL[material.unidad_id] ?? "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-bold ${
                      estado === "reponer" ? "text-semaforo-rojo" : ""
                    }`}
                  >
                    {formatCantidad(existencia.cantidad_disponible)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-neutro">
                    {formatCantidad(existencia.cantidad_reservada)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatCOP(material.costo_promedio)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-neutro">
                    {formatCantidad(material.buffer_min)}–
                    {formatCantidad(material.buffer_max)}
                  </td>
                  <td className="px-3 py-2.5">
                    <BarraBuffer
                      disponible={existencia.cantidad_disponible}
                      material={material}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <BadgeEstadoBuffer
                      estado={estado}
                      sugerirHref={`/produccion/compras?sugerir=${material.id}&cantidad=${Math.max(
                        1,
                        Math.ceil(
                          material.buffer_max - existencia.cantidad_disponible,
                        ),
                      )}`}
                    />
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-[13px] text-neutro"
                >
                  No hay materiales con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tendencia de compras */}
      <div className="mt-6">
        <TendenciaCompras
          compras={compras}
          materiales={filasMP.map((f) => ({
            id: f.material.id,
            nombre: f.material.nombre,
          }))}
        />
      </div>

      {/* Producto terminado */}
      <h2 className="mt-8 text-[16px] font-extrabold tracking-tight">
        Producto terminado
      </h2>
      <p className="mb-3 mt-0.5 text-[12.5px] text-neutro">
        Stock de productos listos en bodega (MTS y comercializados).
      </p>
      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde bg-sutil text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-2.5 font-semibold">Producto</th>
              <th className="px-3 py-2.5 font-semibold">SKU</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Disponible
              </th>
              <th className="px-4 py-2.5 text-right font-semibold">
                Reservada
              </th>
            </tr>
          </thead>
          <tbody>
            {filasPT.map(({ existencia, producto }) => (
              <tr
                key={existencia.id}
                className="border-b border-[#f6f5f2] last:border-b-0 hover:bg-sutil"
              >
                <td className="px-4 py-2.5 font-semibold">{producto.nombre}</td>
                <td className="px-3 py-2.5 text-neutro">{producto.sku}</td>
                <td className="px-3 py-2.5 text-right font-bold">
                  {formatCantidad(existencia.cantidad_disponible)}
                </td>
                <td className="px-4 py-2.5 text-right text-neutro">
                  {formatCantidad(existencia.cantidad_reservada)}
                </td>
              </tr>
            ))}
            {filasPT.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[13px] text-neutro"
                >
                  Sin producto terminado en bodega.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
