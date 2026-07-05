"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BadgeGarantia } from "@/app/(erp)/produccion/ordenes/badges";
import type { GarantiaCard, GarantiaFiltros, OpCard } from "@/lib/data/ops";
import { formatCOP, formatFechaCorta } from "@/lib/formato";
import type { Garantia, Usuario } from "@/lib/types/db";
import { crearGarantia } from "./actions";

interface Props {
  cards: GarantiaCard[];
  opsParaGarantia: OpCard[]; // OPs activas (para el formulario de creación)
  usuarios: Usuario[];
  filtrosIniciales: GarantiaFiltros;
}

export const RECOGIDA_LABEL: Record<Garantia["recogida"], string> = {
  por_definir: "Por definir",
  bravefit_recoge: "Bravefit recoge",
  cliente_envia: "Cliente envía",
};

const inputCls =
  "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

/**
 * Garantías: prioridad ambulancia. KPIs del mes/año (requisito del dueño),
 * lista con distintivo GARANTÍA y días abiertos, creación desde una OP
 * (hereda cliente y muestra los productos de esa OP).
 * Las fichas viven en el MISMO flujo de etapas del kanban de OPs.
 */
export function GarantiasClient({
  cards,
  opsParaGarantia,
  usuarios,
  filtrosIniciales,
}: Props) {
  const router = useRouter();
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const q = filtros.texto?.trim().toLowerCase();
    return cards.filter((c) => {
      if (filtros.estado === "abiertas" && c.garantia.cerrada_en) return false;
      if (filtros.estado === "cerradas" && !c.garantia.cerrada_en) return false;
      if (q) {
        const blob = [
          c.garantia.numero,
          c.cliente.nombre,
          c.producto?.nombre ?? "",
          c.garantia.problema,
          c.op_numero,
          c.vendedor?.nombre ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [cards, filtros]);

  const kpis = useMemo(() => {
    const hoy = new Date();
    const esteMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const esteAnio = String(hoy.getFullYear());
    const delMes = cards.filter((c) => c.garantia.abierta_en.startsWith(esteMes));
    const delAnio = cards.filter((c) => c.garantia.abierta_en.startsWith(esteAnio));
    return {
      abiertas: cards.filter((c) => !c.garantia.cerrada_en).length,
      mes: delMes.length,
      anio: delAnio.length,
      costoAnio: delAnio.reduce((a, c) => a + (c.garantia.costo_resolucion ?? 0), 0),
    };
  }, [cards]);

  function actualizar(nuevos: GarantiaFiltros) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.estado) p.set("estado", nuevos.estado);
    if (nuevos.texto) p.set("q", nuevos.texto);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">Producción y Logística /</p>
          <h1 className="flex items-center gap-3 text-[26px] font-extrabold tracking-tight">
            Garantías <BadgeGarantia grande />
          </h1>
          <p className="mt-0.5 text-[12.5px] text-neutro">
            Prioridad ambulancia: comparten el flujo de producción y van SIEMPRE de
            primeras en cada etapa del kanban.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreando((v) => !v)}
          className="rounded-pill bg-semaforo-rojo px-5 py-2.5 text-[13.5px] font-bold text-white hover:opacity-90"
        >
          {creando ? "Cerrar formulario" : "+ Abrir garantía"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-rojo/30 bg-rojo-bg px-4 py-3 text-[13px] font-semibold text-rojo">
          {error}
        </div>
      )}

      {/* KPIs mes/año — requisito explícito del dueño */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Abiertas ahora", kpis.abiertas, kpis.abiertas > 0 ? "text-semaforo-rojo" : ""],
          ["Abiertas este mes", kpis.mes, ""],
          ["Abiertas este año", kpis.anio, ""],
          ["Costo resolución (año)", formatCOP(kpis.costoAnio), ""],
        ].map(([label, valor, extra]) => (
          <div key={label as string} className="rounded-card border border-borde bg-card px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              {label}
            </p>
            <p className={`text-[22px] font-extrabold ${extra}`}>{valor}</p>
          </div>
        ))}
      </div>

      {creando && (
        <FormNuevaGarantia
          ops={opsParaGarantia}
          usuarios={usuarios}
          onListo={(id) => {
            setCreando(false);
            router.push(`/produccion/garantias/${id}`);
          }}
          onError={setError}
        />
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          defaultValue={filtros.texto}
          onChange={(e) => actualizar({ ...filtros, texto: e.target.value })}
          placeholder="Buscar GR, cliente, producto, falla, OP…"
          className={`${inputCls} w-full max-w-[320px]`}
        />
        <div className="flex gap-1.5">
          {(
            [
              [undefined, "Todas"],
              ["abiertas", "Abiertas"],
              ["cerradas", "Cerradas"],
            ] as const
          ).map(([clave, nombre]) => (
            <button
              key={nombre}
              type="button"
              onClick={() => actualizar({ ...filtros, estado: clave })}
              className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
                filtros.estado === clave
                  ? "border-carbon bg-carbon text-white"
                  : "border-borde bg-card text-neutro hover:border-dorado"
              }`}
            >
              {nombre}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtradas.length}</b> garantías
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[920px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-3 font-bold">Garantía</th>
              <th className="px-4 py-3 font-bold">Cliente</th>
              <th className="px-4 py-3 font-bold">Producto · Falla</th>
              <th className="px-4 py-3 font-bold">OP</th>
              <th className="px-4 py-3 font-bold">Vendedor</th>
              <th className="px-4 py-3 font-bold">Recogida</th>
              <th className="px-4 py-3 font-bold">Etapa</th>
              <th className="px-4 py-3 text-right font-bold">Días</th>
              <th className="px-4 py-3 text-right font-bold">Costo</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr
                key={c.garantia.id}
                onClick={() => router.push(`/produccion/garantias/${c.garantia.id}`)}
                className={`cursor-pointer border-b border-borde last:border-0 ${
                  c.garantia.cerrada_en
                    ? "bg-card text-neutro hover:bg-sutil"
                    : "bg-rojo-bg/40 hover:bg-rojo-bg/70"
                }`}
              >
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-bold">
                    {!c.garantia.cerrada_en && <BadgeGarantia />}
                    {c.garantia.numero}
                  </span>
                </td>
                <td className="px-4 py-3">{c.cliente.nombre}</td>
                <td className="max-w-[280px] px-4 py-3">
                  <span className="font-semibold">{c.producto?.nombre ?? "—"}</span>
                  <span className="block truncate text-[12px] text-neutro">
                    {c.garantia.problema}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">{c.op_numero}</td>
                <td className="px-4 py-3 text-neutro">
                  {c.vendedor?.nombre.split(" ")[0] ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-pill bg-neutro-bg px-2 py-0.5 text-[10.5px] font-bold text-neutro">
                    {RECOGIDA_LABEL[c.garantia.recogida]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.garantia.cerrada_en ? (
                    <span className="rounded-pill bg-verde-bg px-2.5 py-0.5 text-[11px] font-bold text-verde">
                      Cerrada {formatFechaCorta(new Date(c.garantia.cerrada_en))}
                    </span>
                  ) : (
                    <span className="rounded-pill bg-azul-bg px-2.5 py-0.5 text-[11px] font-bold text-azul">
                      {c.etapa.nombre}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-bold">
                  {c.dias === 0 ? "hoy" : c.dias}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.garantia.costo_resolucion
                    ? formatCOP(c.garantia.costo_resolucion)
                    : "—"}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-neutro">
                  No hay garantías con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Abrir garantía: se ancla a una OP (hereda cliente) + producto de esa OP. */
function FormNuevaGarantia({
  ops,
  usuarios,
  onListo,
  onError,
}: {
  ops: OpCard[];
  usuarios: Usuario[];
  onListo: (id: string) => void;
  onError: (e: string | null) => void;
}) {
  const [opId, setOpId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [problema, setProblema] = useState("");
  const [detalle, setDetalle] = useState("");
  const [recogida, setRecogida] = useState<Garantia["recogida"]>("por_definir");
  const [vendedorId, setVendedorId] = useState("");
  const [guardando, setGuardando] = useState(false);

  const op = ops.find((o) => o.id === opId);

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await crearGarantia({
      op_id: opId,
      producto_id: productoId || null,
      problema,
      detalle: detalle.trim() || null,
      recogida,
      vendedor_id: vendedorId || null,
    });
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onListo(r.id!);
  }

  return (
    <div className="mb-5 rounded-card border border-semaforo-rojo/40 bg-card p-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-semaforo-rojo">
        Abrir garantía — entra a "En Cola" con prioridad sobre las OPs
      </p>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          OP DE ORIGEN * (hereda el cliente)
          <select
            className={inputCls}
            value={opId}
            onChange={(e) => {
              setOpId(e.target.value);
              setProductoId("");
            }}
          >
            <option value="">Seleccionar…</option>
            {ops.map((o) => (
              <option key={o.id} value={o.id}>
                {o.numero} — {o.cliente.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          PRODUCTO CON LA FALLA
          <select
            className={inputCls}
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            disabled={!op}
          >
            <option value="">Seleccionar…</option>
            {op?.items.map((i) => (
              <option key={i.id} value={i.producto_id}>
                {i.producto.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          VENDEDOR (para consultas del cliente)
          <select
            className={inputCls}
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro sm:col-span-2">
          FALLA REPORTADA *
          <input
            className={inputCls}
            value={problema}
            onChange={(e) => setProblema(e.target.value)}
            placeholder="Ej: Pin de ajuste del respaldo no bloquea"
          />
        </label>
        <div className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          RECOGIDA DE LA PIEZA
          <div className="flex gap-1.5">
            {(Object.keys(RECOGIDA_LABEL) as Garantia["recogida"][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setRecogida(k)}
                className={`flex-1 rounded-input border px-2 py-2 text-[11.5px] font-bold ${
                  recogida === k
                    ? "border-carbon bg-carbon text-white"
                    : "border-borde bg-card text-neutro hover:border-dorado"
                }`}
              >
                {RECOGIDA_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-[11px] font-bold text-neutro">
        DETALLE
        <textarea
          rows={2}
          className={inputCls}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={guardando || !opId || !problema.trim()}
        onClick={() => void guardar()}
        className="mt-3 rounded-pill bg-semaforo-rojo px-5 py-2.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        {guardando ? "Abriendo…" : "Abrir garantía"}
      </button>
    </div>
  );
}
