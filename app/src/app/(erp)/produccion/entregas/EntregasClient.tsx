"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  aplicarFiltrosEntregas,
  type EntregaRow,
  type FiltrosEntregas,
  type ResumenMensual,
} from "@/lib/data/entregas";
import { formatCOP, formatFechaCorta } from "@/lib/formato";
import { parseFechaLocal } from "@/lib/ops-logic";
import { TendenciaEntregas } from "./TendenciaEntregas";
import { BadgeInstalacion, BadgeOrigen, mesLargo } from "./ui";

interface Props {
  filas: EntregaRow[]; // desc por fecha entregada
  resumen: ResumenMensual[]; // asc por mes (14 meses)
  filtrosIniciales: FiltrosEntregas;
}

/** Clave 'YYYY-MM' del mes de hoy. */
function mesActualClave(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Entregas: KPIs de orgullo + tendencia mensual + tabla filtrable. */
export function EntregasClient({ filas, resumen, filtrosIniciales }: Props) {
  const [filtros, setFiltros] = useState(filtrosIniciales);

  const filtradas = useMemo(
    () => aplicarFiltrosEntregas(filas, filtros),
    [filas, filtros],
  );

  const kpis = useMemo(() => {
    const mesClave = mesActualClave();
    const anio = new Date().getFullYear();
    const delMes = filas.filter((f) => f.fecha_entregada.startsWith(mesClave));
    const delAnio = filas.filter(
      (f) => Number(f.fecha_entregada.slice(0, 4)) === anio,
    );
    // Récord mensual sobre la serie (14 meses); empate → el más reciente.
    const record = resumen.reduce<ResumenMensual | null>(
      (max, r) =>
        r.entregas > 0 && (!max || r.entregas >= max.entregas) ? r : max,
      null,
    );
    return {
      esteMes: delMes.length,
      esteAnio: delAnio.length,
      valorAnio: delAnio.reduce((s, f) => s + f.valor, 0),
      record,
      anio,
    };
  }, [filas, resumen]);

  // Opciones de filtros derivadas de los datos disponibles
  const opciones = useMemo(() => {
    const meses = [...new Set(filas.map((f) => f.fecha_entregada.slice(0, 7)))]
      .sort()
      .reverse();
    const anios = [...new Set(filas.map((f) => Number(f.fecha_entregada.slice(0, 4))))]
      .sort((a, b) => b - a);
    const ciudades = [...new Set(filas.map((f) => f.ciudad_nombre))].sort(
      (a, b) => a.localeCompare(b, "es"),
    );
    return { meses, anios, ciudades };
  }, [filas]);

  const valorFiltrado = useMemo(
    () => filtradas.reduce((s, f) => s + f.valor, 0),
    [filtradas],
  );

  function actualizar(nuevos: FiltrosEntregas) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.mes) p.set("mes", nuevos.mes);
    if (nuevos.anio) p.set("anio", String(nuevos.anio));
    if (nuevos.ciudad) p.set("ciudad", nuevos.ciudad);
    if (nuevos.texto) p.set("q", nuevos.texto);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12.5px] text-neutro">Producción /</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">
            Entregas
          </h1>
          <p className="mt-0.5 text-[13px] text-neutro">
            Pedidos entregados: mes, año y récord histórico. Clic en el número
            para abrir la O.P.
          </p>
        </div>
        <Link
          href="/produccion/ordenes?semaforo=rojo"
          className="text-[13px] font-semibold text-dorado-oscuro hover:underline"
        >
          Ver próximas a vencer →
        </Link>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Entregas este mes
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">
            {kpis.esteMes}
          </p>
          <p className="text-[11px] text-neutro">{mesLargo(mesActualClave())}</p>
        </div>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Entregas este año
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">
            {kpis.esteAnio}
          </p>
          <p className="text-[11px] text-neutro">{kpis.anio}</p>
        </div>
        {/* Récord mensual: métrica de orgullo del dueño → dorado */}
        <div className="rounded-card border border-dorado bg-dorado-suave px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-dorado-oscuro">
            🏆 Récord mensual
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight text-dorado-oscuro">
            {kpis.record?.entregas ?? "—"}
          </p>
          <p className="text-[11px] font-semibold text-dorado-oscuro">
            {kpis.record
              ? `pedidos en ${mesLargo(kpis.record.mes)}`
              : "sin entregas aún"}
          </p>
        </div>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Valor entregado del año
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">
            {formatCOP(kpis.valorAnio)}
          </p>
          <p className="text-[11px] text-neutro">Σ valor de O.P. entregadas</p>
        </div>
      </div>

      {/* Gráfico de entregas por mes */}
      <div className="mb-6">
        <TendenciaEntregas
          resumen={resumen}
          mesRecord={kpis.record?.mes ?? null}
        />
      </div>

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          defaultValue={filtros.texto}
          onChange={(e) => actualizar({ ...filtros, texto: e.target.value })}
          placeholder="Buscar entrega…"
          className="w-full max-w-[280px] rounded-input border border-borde bg-card px-3.5 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <select
          aria-label="Filtrar por mes"
          value={filtros.mes ?? ""}
          onChange={(e) =>
            actualizar({ ...filtros, mes: e.target.value || undefined })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todos los meses</option>
          {opciones.meses.map((m) => (
            <option key={m} value={m}>
              {mesLargo(m)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por año"
          value={filtros.anio ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              anio: Number(e.target.value) || undefined,
            })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todos los años</option>
          {opciones.anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por ciudad"
          value={filtros.ciudad ?? ""}
          onChange={(e) =>
            actualizar({ ...filtros, ciudad: e.target.value || undefined })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todas las ciudades</option>
          {opciones.ciudades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtradas.length}</b>{" "}
          {filtradas.length === 1 ? "entrega" : "entregas"} ·{" "}
          <b className="text-carbon">{formatCOP(valorFiltrado)}</b>
        </span>
      </div>

      {/* Tabla de entregas */}
      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[1020px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde bg-sutil text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-2.5 font-semibold">Número</th>
              <th className="px-3 py-2.5 font-semibold">Cliente</th>
              <th className="px-3 py-2.5 font-semibold">Ciudad</th>
              <th className="px-3 py-2.5 font-semibold">Producto principal</th>
              <th className="px-3 py-2.5 text-right font-semibold">Und</th>
              <th className="px-3 py-2.5 font-semibold">Instalación</th>
              <th className="px-3 py-2.5 font-semibold">Origen</th>
              <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
              <th className="px-4 py-2.5 font-semibold">Entregada</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((f) => (
              <tr
                key={f.numero}
                className="border-b border-[#f6f5f2] last:border-b-0 hover:bg-sutil"
              >
                <td className="px-4 py-2.5">
                  {f.op_id ? (
                    <Link
                      href={`/produccion/ordenes/${f.op_id}`}
                      className="font-semibold hover:text-dorado-oscuro hover:underline"
                    >
                      {f.numero}
                    </Link>
                  ) : (
                    <span
                      className="font-semibold text-neutro"
                      title="Entrega histórica (sin O.P. en el sistema)"
                    >
                      {f.numero}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">{f.cliente_nombre}</td>
                <td className="px-3 py-2.5 text-neutro">{f.ciudad_nombre}</td>
                <td className="px-3 py-2.5">{f.producto_principal}</td>
                <td className="px-3 py-2.5 text-right font-bold">
                  {f.unidades}
                </td>
                <td className="px-3 py-2.5">
                  {f.requiere_instalacion ? (
                    <BadgeInstalacion />
                  ) : (
                    <span className="text-[11px] text-neutro">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <BadgeOrigen clave={f.origen_clave} />
                </td>
                <td className="px-3 py-2.5 text-right font-bold">
                  {formatCOP(f.valor)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-neutro">
                  {formatFechaCorta(parseFechaLocal(f.fecha_entregada))}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-[13px] text-neutro"
                >
                  No hay entregas con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
