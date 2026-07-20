"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  esCotizacionArchivada,
  type CotizacionCard,
  type FiltrosCotizaciones,
} from "@/lib/data/crm-cotizaciones";
import { formatCOP, formatFechaCorta } from "@/lib/formato";
import { parseFechaLocal } from "@/lib/ops-logic";
import type { EstadoCotizacion, Usuario } from "@/lib/types/db";
import { BadgeEstadoCotizacion } from "./badges";

interface Props {
  cardsIniciales: CotizacionCard[];
  estados: EstadoCotizacion[];
  vendedores: Usuario[];
  filtrosIniciales: FiltrosCotizaciones;
}

/** Lista de cotizaciones: filtros + tabla densa; vencidas resaltadas. */
export function CotizacionesClient({
  cardsIniciales,
  estados,
  vendedores,
  filtrosIniciales,
}: Props) {
  const router = useRouter();
  const [filtros, setFiltros] = useState(filtrosIniciales);
  // Archivo (patrón OPs): Anuladas y Aprobadas de inmediato; vencidas
  // sin aprobar a los 30 días (seguimiento). false = vista activa.
  const [verArchivo, setVerArchivo] = useState(false);

  const archivadas = useMemo(
    () => cardsIniciales.filter((c) => esCotizacionArchivada(c)),
    [cardsIniciales],
  );

  const filtradas = useMemo(() => {
    const q = filtros.texto?.trim().toLowerCase();
    const base = verArchivo
      ? archivadas
      : cardsIniciales.filter((c) => !esCotizacionArchivada(c));
    return base.filter((c) => {
      if (filtros.estado_id !== undefined && c.estado.id !== filtros.estado_id)
        return false;
      if (filtros.vendedor_id && c.vendedor.id !== filtros.vendedor_id)
        return false;
      if (filtros.segmento && c.cotizacion.segmento !== filtros.segmento)
        return false;
      if (q) {
        const blob = [c.cotizacion.numero, c.cliente.nombre, c.vendedor.nombre]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [cardsIniciales, archivadas, verArchivo, filtros]);

  function actualizar(nuevos: FiltrosCotizaciones) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.estado_id) p.set("estado", String(nuevos.estado_id));
    if (nuevos.vendedor_id) p.set("vendedor", nuevos.vendedor_id);
    if (nuevos.segmento) p.set("segmento", nuevos.segmento);
    if (nuevos.texto) p.set("q", nuevos.texto);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  const totalVisible = filtradas.reduce((a, c) => a + c.total, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">Ventas /</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">
            Cotizaciones
          </h1>
        </div>
        <a
          href="/ventas/cotizaciones/nueva"
          className="rounded-pill bg-carbon px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black"
        >
          + Nueva cotización
        </a>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          defaultValue={filtros.texto}
          onChange={(e) => actualizar({ ...filtros, texto: e.target.value })}
          placeholder="Buscar número, cliente o vendedor…"
          className="w-full max-w-[320px] rounded-input border border-borde bg-card px-3.5 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <select
          aria-label="Filtrar por estado"
          value={filtros.estado_id ?? ""}
          onChange={(e) =>
            actualizar({ ...filtros, estado_id: Number(e.target.value) || undefined })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todos los estados</option>
          {estados.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por vendedor"
          value={filtros.vendedor_id ?? ""}
          onChange={(e) =>
            actualizar({ ...filtros, vendedor_id: e.target.value || undefined })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todos los vendedores</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por segmento"
          value={filtros.segmento ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              segmento: (e.target.value || undefined) as FiltrosCotizaciones["segmento"],
            })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">B2B y B2C</option>
          <option value="B2B">B2B</option>
          <option value="B2C">B2C</option>
        </select>
        <button
          type="button"
          onClick={() => setVerArchivo((v) => !v)}
          className={`rounded-pill border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
            verArchivo
              ? "border-carbon bg-carbon text-white"
              : "border-borde bg-card text-neutro hover:border-dorado"
          }`}
          title="Anuladas y Aprobadas de inmediato; vencidas sin aprobar, 30 días después de su validez (seguimiento)"
        >
          🗄 Archivo ({archivadas.length})
        </button>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtradas.length}</b> cotizaciones ·{" "}
          <b className="text-carbon">{formatCOP(totalVisible)}</b>
        </span>
      </div>

      <div className="overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-3 font-bold">Número</th>
              <th className="px-4 py-3 font-bold">Cliente</th>
              <th className="px-4 py-3 font-bold">Vendedor</th>
              <th className="px-4 py-3 font-bold">Seg.</th>
              <th className="px-4 py-3 font-bold">Estado</th>
              <th className="px-4 py-3 text-right font-bold">Total</th>
              <th className="px-4 py-3 font-bold">Válida hasta</th>
              <th className="px-4 py-3 font-bold">Creada</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr
                key={c.cotizacion.id}
                onClick={() => router.push(`/ventas/cotizaciones/${c.cotizacion.id}`)}
                className={`cursor-pointer border-b border-borde last:border-0 ${
                  c.vencida ? "bg-ambar-bg hover:bg-[#fbeccb]" : "bg-card hover:bg-sutil"
                }`}
              >
                <td className="px-4 py-3 font-bold">
                  {c.cotizacion.numero}
                  {c.cotizacion.no_facturar && (
                    <span className="ml-2 rounded-pill bg-neutro-bg px-2 py-0.5 text-[10px] font-bold text-neutro">
                      No facturar
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{c.cliente.nombre}</td>
                <td className="px-4 py-3 text-neutro">{c.vendedor.nombre}</td>
                <td className="px-4 py-3">
                  <span className="rounded-pill bg-neutro-bg px-2 py-0.5 text-[10.5px] font-bold text-neutro">
                    {c.cotizacion.segmento}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <BadgeEstadoCotizacion nombre={c.estado.nombre} vencida={c.vencida} />
                </td>
                <td className="px-4 py-3 text-right font-bold">
                  {formatCOP(c.total)}
                </td>
                <td className={`px-4 py-3 ${c.vencida ? "font-bold text-ambar" : ""}`}>
                  {formatFechaCorta(parseFechaLocal(c.cotizacion.valida_hasta))}
                </td>
                <td className="px-4 py-3 text-neutro">
                  {formatFechaCorta(new Date(c.cotizacion.creado_en))}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutro">
                  No hay cotizaciones con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
