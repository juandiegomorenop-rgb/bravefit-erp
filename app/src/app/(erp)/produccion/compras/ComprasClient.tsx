"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  esScArchivada,
  type FaltanteCard,
  type FiltrosCompras,
  type ScItemInput,
  type SolicitudCard,
} from "@/lib/data/compras";
import { formatCOP, formatFechaCorta } from "@/lib/formato";
import { parseFechaLocal } from "@/lib/ops-logic";
import type { Material, Proveedor, TipoMaterial } from "@/lib/types/db";
import {
  cambiarEstadoSc,
  crearSolicitud,
  registrarRecepcion,
  resolverFaltante,
} from "./actions";

interface Props {
  cards: SolicitudCard[];
  faltantes: FaltanteCard[];
  tipos: TipoMaterial[];
  materiales: Material[];
  proveedores: Proveedor[];
  filtrosIniciales: FiltrosCompras;
  /** Atajo "Sugerir SC" de Inventarios: abre el form con el material
   *  pedido + su JUEGO (compañeros de BOM en REPONER), cantidades
   *  óptimo − disponible, y una nota que explica el origen. */
  prefill?: {
    items: { material_id: string; cantidad: number }[];
    nota?: string;
  };
  /** Qué tipos de material vende cada proveedor (filtra el selector). */
  proveedorTipos: { proveedor_id: string; tipo_material_id: number }[];
}

const ESTADOS: { clave: FiltrosCompras["estado"]; nombre: string; badge: string }[] = [
  { clave: "pendiente", nombre: "Pendiente", badge: "bg-neutro-bg text-neutro" },
  { clave: "en_cotizacion", nombre: "En cotización", badge: "bg-azul-bg text-azul" },
  { clave: "comprado", nombre: "Comprada", badge: "bg-verde-bg text-verde" },
  { clave: "rechazada", nombre: "Rechazada", badge: "bg-rojo-bg text-rojo" },
];

const inputCls =
  "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

/**
 * Solicitudes de Compra: UN renglón por solicitud (tipo de material);
 * clic expande la lista interna de ítems con recibido/faltante y las
 * acciones del flujo pendiente → en cotización → comprada (valor y
 * fecha obligatorios) / rechazada. Recepción ítem por ítem y faltantes
 * en seguimiento hasta cierre.
 */
export function ComprasClient({
  cards,
  faltantes,
  tipos,
  materiales,
  proveedores,
  filtrosIniciales,
  prefill,
  proveedorTipos,
}: Props) {
  const router = useRouter();
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [abierta, setAbierta] = useState<string | null>(null);
  // Con prefill (atajo Sugerir SC de Inventarios) el form abre solo
  const [creando, setCreando] = useState(!!prefill);
  const [error, setError] = useState<string | null>(null);

  // Archivo: rechazadas (de una) y compradas recibidas completas hace
  // más de 7 días — dejan de estorbar pero quedan consultables.
  const [verArchivo, setVerArchivo] = useState(false);
  const archivadas = useMemo(() => cards.filter((c) => esScArchivada(c)), [cards]);

  const filtradas = useMemo(() => {
    const q = filtros.texto?.trim().toLowerCase();
    const base = verArchivo
      ? archivadas
      : cards.filter((c) => !esScArchivada(c));
    return base.filter((c) => {
      if (filtros.estado && c.sc.estado !== filtros.estado) return false;
      if (
        filtros.tipo_material_id !== undefined &&
        c.sc.tipo_material_id !== filtros.tipo_material_id
      )
        return false;
      if (q) {
        const blob = [
          c.sc.numero,
          c.tipo.nombre,
          c.proveedor?.nombre ?? "",
          c.sc.notas ?? "",
          ...c.items.map((i) => i.material?.nombre ?? i.descripcion ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [cards, archivadas, verArchivo, filtros]);

  function actualizar(nuevos: FiltrosCompras) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.estado) p.set("estado", nuevos.estado);
    if (nuevos.tipo_material_id) p.set("tipo", String(nuevos.tipo_material_id));
    if (nuevos.texto) p.set("q", nuevos.texto);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  const kpis = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      pendientes: cards.filter((c) => c.sc.estado === "pendiente").length,
      cotizando: cards.filter((c) => c.sc.estado === "en_cotizacion").length,
      porLlegar: cards.filter(
        (c) =>
          c.sc.estado === "comprado" && !c.recepcion_completa &&
          (c.sc.fecha_entrega ?? "") >= hoy,
      ).length,
      faltantes: faltantes.length,
    };
  }, [cards, faltantes]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">Producción y Logística /</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">
            Solicitudes de compra
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreando((v) => !v)}
          className="rounded-pill bg-carbon px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-black"
        >
          {creando ? "Cerrar formulario" : "+ Nueva solicitud"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-rojo/30 bg-rojo-bg px-4 py-3 text-[13px] font-semibold text-rojo">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Pendientes", kpis.pendientes, ""],
          ["En cotización", kpis.cotizando, ""],
          ["Compradas por llegar", kpis.porLlegar, ""],
          ["Faltantes en seguimiento", kpis.faltantes, kpis.faltantes > 0 ? "text-rojo" : ""],
        ].map(([label, valor, extra]) => (
          <div key={label as string} className="rounded-card border border-borde bg-card px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              {label}
            </p>
            <p className={`text-[24px] font-extrabold ${extra}`}>{valor}</p>
          </div>
        ))}
      </div>

      {creando && (
        <FormNuevaSolicitud
          tipos={tipos}
          materiales={materiales}
          inicial={prefill}
          onListo={() => {
            setCreando(false);
            router.refresh();
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
          placeholder="Buscar SC, material, proveedor…"
          className={`${inputCls} w-full max-w-[300px]`}
        />
        <select
          aria-label="Filtrar por estado"
          value={filtros.estado ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              estado: (e.target.value || undefined) as FiltrosCompras["estado"],
            })
          }
          className={inputCls}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((s) => (
            <option key={s.clave} value={s.clave}>
              {s.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por tipo de material"
          value={filtros.tipo_material_id ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              tipo_material_id: Number(e.target.value) || undefined,
            })
          }
          className={inputCls}
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setVerArchivo((v) => !v)}
          title="Rechazadas y compradas ya recibidas hace más de 7 días"
          className={`rounded-pill border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
            verArchivo
              ? "border-carbon bg-carbon text-white"
              : "border-borde bg-card text-neutro hover:border-dorado"
          }`}
        >
          🗄 Archivo ({archivadas.length})
        </button>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtradas.length}</b> solicitudes
        </span>
      </div>

      {/* Tabla: un renglón por solicitud, expandible */}
      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[880px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-3 font-bold">Solicitud</th>
              <th className="px-4 py-3 font-bold">Tipo de material</th>
              <th className="px-4 py-3 text-center font-bold">Ítems</th>
              <th className="px-4 py-3 font-bold">Estado</th>
              <th className="px-4 py-3 text-right font-bold">Valor estimado</th>
              <th className="px-4 py-3 font-bold">Entrega</th>
              <th className="px-4 py-3 font-bold">Solicitante</th>
              <th className="px-4 py-3 font-bold">Creada</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <FilaSolicitud
                key={c.sc.id}
                card={c}
                abierta={abierta === c.sc.id}
                onToggle={() => setAbierta(abierta === c.sc.id ? null : c.sc.id)}
                proveedores={proveedores}
                proveedorTipos={proveedorTipos}
                onError={setError}
                onRefrescar={() => router.refresh()}
              />
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutro">
                  No hay solicitudes con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Faltantes en seguimiento */}
      <h2 className="mt-8 text-[17px] font-extrabold tracking-tight">
        Faltantes en seguimiento
        {faltantes.length > 0 && (
          <span className="ml-2 rounded-pill bg-rojo-bg px-2.5 py-0.5 text-[12px] font-bold text-rojo">
            {faltantes.length}
          </span>
        )}
      </h2>
      <div className="mt-3 space-y-2">
        {faltantes.length === 0 && (
          <p className="rounded-card border border-borde bg-card px-4 py-5 text-center text-[13px] text-neutro">
            Sin faltantes pendientes — todo lo comprado llegó completo. 🎉
          </p>
        )}
        {faltantes.map((f) => (
          <FilaFaltante
            key={f.recepcion_item.id}
            f={f}
            onError={setError}
            onRefrescar={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
function BadgeEstadoSc({ estado }: { estado: SolicitudCard["sc"]["estado"] }) {
  const e = ESTADOS.find((x) => x.clave === estado)!;
  return (
    <span className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${e.badge}`}>
      {e.nombre}
    </span>
  );
}

function FilaSolicitud({
  card: c,
  abierta,
  onToggle,
  proveedores,
  proveedorTipos,
  onError,
  onRefrescar,
}: {
  card: SolicitudCard;
  abierta: boolean;
  onToggle: () => void;
  proveedores: Proveedor[];
  proveedorTipos: { proveedor_id: string; tipo_material_id: number }[];
  onError: (e: string | null) => void;
  onRefrescar: () => void;
}) {
  // Anti-error de digitación (regla de Juan): solo proveedores que
  // venden ESTE tipo de material. Un proveedor sin tipos registrados
  // aparece igual (fallback mientras se nutre el filtro).
  const proveedoresDelTipo = proveedores.filter((p) => {
    const tipos = proveedorTipos.filter((t) => t.proveedor_id === p.id);
    return (
      tipos.length === 0 ||
      tipos.some((t) => t.tipo_material_id === c.sc.tipo_material_id)
    );
  });
  const [valor, setValor] = useState(c.sc.valor_estimado ?? 0);
  const [fecha, setFecha] = useState("");
  const [proveedor, setProveedor] = useState(c.sc.proveedor_id ?? "");
  const [recibiendo, setRecibiendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<{ ok: boolean; error?: string }>) {
    onError(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) {
      onError(r.error ?? "Error");
      return;
    }
    onRefrescar();
  }

  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-borde ${
          abierta ? "bg-sutil" : "bg-card hover:bg-sutil"
        }`}
      >
        <td className="px-4 py-3 font-bold">
          <span className="mr-1.5 inline-block w-3 text-neutro">
            {abierta ? "▾" : "▸"}
          </span>
          {c.sc.numero}
          {c.sc.op_id && (
            <span className="ml-2 rounded-pill bg-dorado-suave px-2 py-0.5 text-[10px] font-bold text-dorado-oscuro">
              De OP
            </span>
          )}
        </td>
        <td className="px-4 py-3">{c.tipo.nombre}</td>
        <td className="px-4 py-3 text-center">{c.items.length}</td>
        <td className="px-4 py-3">
          <BadgeEstadoSc estado={c.sc.estado} />
          {c.sc.estado === "comprado" && c.recepcion_completa && (
            <span className="ml-1.5 rounded-pill bg-verde-bg px-2 py-0.5 text-[10px] font-bold text-verde">
              Recibida ✓
            </span>
          )}
          {c.faltantes_abiertos > 0 && (
            <span className="ml-1.5 rounded-pill bg-rojo-bg px-2 py-0.5 text-[10px] font-bold text-rojo">
              Faltantes
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-semibold">
          {c.sc.valor_estimado ? formatCOP(c.sc.valor_estimado) : "—"}
        </td>
        <td className="px-4 py-3">
          {c.sc.fecha_entrega
            ? formatFechaCorta(parseFechaLocal(c.sc.fecha_entrega))
            : "—"}
        </td>
        <td className="px-4 py-3 text-neutro">{c.solicitante.nombre.split(" ")[0]}</td>
        <td className="px-4 py-3 text-neutro">
          {formatFechaCorta(new Date(c.sc.creado_en))}
        </td>
      </tr>
      {abierta && (
        <tr className="border-b border-borde bg-sutil/60">
          <td colSpan={8} className="px-6 pb-5 pt-1">
            {c.sc.notas && (
              <p className="mb-3 text-[12.5px] italic text-neutro">{c.sc.notas}</p>
            )}
            {/* lista interna de ítems */}
            <table className="w-full max-w-[720px] border-collapse text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-neutro">
                  <th className="py-1.5 pr-3 font-bold">Ítem</th>
                  <th className="px-3 py-1.5 text-right font-bold">Pedida</th>
                  <th className="px-3 py-1.5 text-right font-bold">Recibida</th>
                  <th className="px-3 py-1.5 text-right font-bold">Faltante abierto</th>
                </tr>
              </thead>
              <tbody>
                {c.items.map((i) => (
                  <tr key={i.id} className="border-t border-borde">
                    <td className="py-2 pr-3">
                      {i.material?.nombre ?? i.descripcion}
                    </td>
                    <td className="px-3 py-2 text-right">{i.cantidad}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={i.recibido >= i.cantidad ? "font-bold text-verde" : ""}>
                        {i.recibido}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {i.faltante_abierto > 0 ? (
                        <b className="text-rojo">{i.faltante_abierto}</b>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* acciones según estado */}
            <div className="mt-4 flex flex-wrap items-end gap-2.5">
              {c.sc.estado === "pendiente" && (
                <>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void accion(() => cambiarEstadoSc(c.sc.id, "en_cotizacion"))}
                    className="rounded-pill bg-azul px-4 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Pasar a cotización
                  </button>
                  <BotonRechazar id={c.sc.id} ocupado={ocupado} accion={accion} />
                </>
              )}
              {c.sc.estado === "en_cotizacion" && (
                <>
                  <label className="flex flex-col gap-1 text-[10.5px] font-bold text-neutro">
                    VALOR COTIZADO (COP)
                    <input
                      type="number"
                      min={0}
                      className={`${inputCls} w-[140px]`}
                      value={valor || ""}
                      onChange={(e) => setValor(Number(e.target.value) || 0)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10.5px] font-bold text-neutro">
                    PROVEEDOR
                    <select
                      className={inputCls}
                      value={proveedor}
                      onChange={(e) => setProveedor(e.target.value)}
                    >
                      <option value="">Seleccionar…</option>
                      {proveedoresDelTipo.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[10.5px] font-bold text-neutro">
                    FECHA DE ENTREGA
                    <input
                      type="date"
                      className={inputCls}
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() =>
                      void accion(() =>
                        cambiarEstadoSc(c.sc.id, "comprado", {
                          valor_estimado: valor,
                          fecha_entrega: fecha,
                          proveedor_id: proveedor || null,
                        }),
                      )
                    }
                    className="rounded-pill bg-verde px-4 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Marcar comprada
                  </button>
                  <BotonRechazar id={c.sc.id} ocupado={ocupado} accion={accion} />
                </>
              )}
              {c.sc.estado === "comprado" && !c.recepcion_completa && (
                <button
                  type="button"
                  onClick={() => setRecibiendo((v) => !v)}
                  className="rounded-pill bg-carbon px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-black"
                >
                  {recibiendo ? "Cerrar recepción" : "📦 Registrar recepción"}
                </button>
              )}
            </div>

            {recibiendo && (
              <FormRecepcion
                card={c}
                onListo={() => {
                  setRecibiendo(false);
                  onRefrescar();
                }}
                onError={onError}
              />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function BotonRechazar({
  id,
  ocupado,
  accion,
}: {
  id: string;
  ocupado: boolean;
  accion: (fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={() => void accion(() => cambiarEstadoSc(id, "rechazada"))}
      className="rounded-pill border border-rojo/40 px-4 py-2 text-[12.5px] font-semibold text-rojo hover:bg-rojo-bg disabled:opacity-50"
    >
      Rechazar
    </button>
  );
}

/** Recepción: checklist ítem por ítem — llegó, cuánto, faltante y nota. */
function FormRecepcion({
  card: c,
  onListo,
  onError,
}: {
  card: SolicitudCard;
  onListo: () => void;
  onError: (e: string | null) => void;
}) {
  const pendientes = c.items.filter((i) => i.recibido < i.cantidad);
  const [filas, setFilas] = useState(
    pendientes.map((i) => ({
      sc_item_id: i.id,
      nombre: i.material?.nombre ?? i.descripcion ?? "Ítem",
      // Solo lo que es material del catálogo sube al inventario
      es_material: !!i.material,
      pendiente: i.cantidad - i.recibido,
      cant_recibida: i.cantidad - i.recibido, // por defecto: llegó todo
      costo_unit: "", // opcional: costo de la factura
      nota: "",
    })),
  );
  const [guardando, setGuardando] = useState(false);
  const hayMateriales = filas.some((f) => f.es_material);

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await registrarRecepcion(
      c.sc.id,
      filas.map((f) => ({
        sc_item_id: f.sc_item_id,
        cant_recibida: f.cant_recibida,
        cant_faltante: Math.max(0, f.pendiente - f.cant_recibida),
        nota: f.nota.trim() || null,
        costo_unit: f.costo_unit.trim() ? Number(f.costo_unit) : null,
      })),
    );
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onListo();
  }

  return (
    <div className="mt-3 max-w-[760px] rounded-[10px] border border-borde bg-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
        Recepción — chequee ítem por ítem
      </p>
      {hayMateriales && (
        <p className="mt-1 text-[11.5px] text-neutro">
          Lo recibido <b>sube al inventario</b> al guardar. El costo unitario es
          opcional: si lo digita (el de la factura) actualiza el costo promedio
          del material; si lo deja vacío se usa el promedio actual.
        </p>
      )}
      <div className="mt-2 space-y-2">
        {filas.map((f, idx) => (
          <div key={f.sc_item_id} className="flex flex-wrap items-center gap-3 text-[12.5px]">
            <span className="min-w-[220px] flex-1 font-semibold">{f.nombre}</span>
            <span className="text-neutro">pendiente {f.pendiente}</span>
            <label className="flex items-center gap-1.5">
              llegó
              <input
                type="number"
                min={0}
                max={f.pendiente}
                className={`${inputCls} w-[84px] py-1`}
                value={f.cant_recibida}
                onChange={(e) =>
                  setFilas((fs) =>
                    fs.map((x, i) =>
                      i === idx
                        ? { ...x, cant_recibida: Math.max(0, Number(e.target.value) || 0) }
                        : x,
                    ),
                  )
                }
              />
            </label>
            <span
              className={`font-bold ${
                f.pendiente - f.cant_recibida > 0 ? "text-rojo" : "text-verde"
              }`}
            >
              {f.pendiente - f.cant_recibida > 0
                ? `faltan ${f.pendiente - f.cant_recibida}`
                : "completo ✓"}
            </span>
            {f.es_material ? (
              <label className="flex items-center gap-1.5 text-neutro">
                costo unit.
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="opcional"
                  className={`${inputCls} w-[110px] py-1`}
                  value={f.costo_unit}
                  onChange={(e) =>
                    setFilas((fs) =>
                      fs.map((x, i) =>
                        i === idx ? { ...x, costo_unit: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
            ) : (
              <span className="text-[11.5px] text-neutro">no mueve inventario</span>
            )}
            <input
              placeholder="Nota (ej: proveedor envía el resto el lunes)"
              className={`${inputCls} min-w-[200px] flex-1 py-1`}
              value={f.nota}
              onChange={(e) =>
                setFilas((fs) =>
                  fs.map((x, i) => (i === idx ? { ...x, nota: e.target.value } : x)),
                )
              }
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={guardando}
        onClick={() => void guardar()}
        className="mt-3 rounded-pill bg-carbon px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Guardar recepción"}
      </button>
    </div>
  );
}

function FilaFaltante({
  f,
  onError,
  onRefrescar,
}: {
  f: FaltanteCard;
  onError: (e: string | null) => void;
  onRefrescar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-rojo/25 bg-rojo-bg/50 px-4 py-3 text-[13px]">
      <b>{f.sc_numero}</b>
      <span className="flex-1">
        {f.material_nombre} — faltan{" "}
        <b className="text-rojo">{f.recepcion_item.cant_faltante}</b>
        {f.recepcion_item.nota && (
          <span className="ml-2 text-[12px] italic text-neutro">
            {f.recepcion_item.nota}
          </span>
        )}
      </span>
      <span className="text-[11.5px] text-neutro">
        desde {formatFechaCorta(new Date(f.fecha_recepcion))}
      </span>
      <button
        type="button"
        disabled={ocupado}
        onClick={async () => {
          onError(null);
          setOcupado(true);
          const r = await resolverFaltante(f.recepcion_item.id, "Faltante recibido/cerrado");
          setOcupado(false);
          if (!r.ok) {
            onError(r.error);
            return;
          }
          onRefrescar();
        }}
        className="rounded-pill bg-verde px-4 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Resolver ✓
      </button>
    </div>
  );
}

/** Nueva solicitud: tipo + ítems (material del tipo o descripción libre). */
function FormNuevaSolicitud({
  tipos,
  materiales,
  inicial,
  onListo,
  onError,
}: {
  tipos: TipoMaterial[];
  materiales: Material[];
  /** Prellenado del atajo "Sugerir SC": material pedido + juego. */
  inicial?: {
    items: { material_id: string; cantidad: number }[];
    nota?: string;
  };
  onListo: () => void;
  onError: (e: string | null) => void;
}) {
  // Solo los materiales del prellenado que existen en el catálogo
  const iniciales = (inicial?.items ?? [])
    .map((it) => ({
      material: materiales.find((m) => m.id === it.material_id),
      cantidad: it.cantidad,
    }))
    .filter((x) => x.material);
  const [tipo, setTipo] = useState<number>(
    iniciales[0]?.material?.tipo_material_id ?? 0,
  );
  const [notas, setNotas] = useState(inicial?.nota ?? "");
  const [items, setItems] = useState<(ScItemInput & { _k: number })[]>(
    iniciales.map((x, n) => ({
      _k: n + 1,
      material_id: x.material!.id,
      descripcion: null,
      cantidad: Math.max(1, x.cantidad),
    })),
  );
  const [guardando, setGuardando] = useState(false);
  const delTipo = materiales.filter((m) => m.tipo_material_id === tipo);

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await crearSolicitud({
      tipo_material_id: tipo,
      notas: notas.trim() || null,
      items: items.map(({ _k, ...i }) => i),
    });
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onListo();
  }

  return (
    <div className="mb-5 rounded-card border border-borde bg-card p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          TIPO DE MATERIAL (un renglón por tipo)
          <select
            className={inputCls}
            value={tipo || ""}
            onChange={(e) => {
              setTipo(Number(e.target.value) || 0);
              setItems([]);
            }}
          >
            <option value="">Seleccionar…</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!tipo}
          onClick={() =>
            setItems((xs) => [
              ...xs,
              { _k: Date.now() + xs.length, material_id: delTipo[0]?.id ?? null, descripcion: null, cantidad: 1 },
            ])
          }
          className="rounded-pill border border-borde px-4 py-2 text-[12.5px] font-semibold hover:border-dorado disabled:opacity-40"
        >
          + Material del catálogo
        </button>
        <button
          type="button"
          disabled={!tipo}
          onClick={() =>
            setItems((xs) => [
              ...xs,
              { _k: Date.now() + xs.length, material_id: null, descripcion: "", cantidad: 1 },
            ])
          }
          className="rounded-pill border border-borde px-4 py-2 text-[12.5px] font-semibold hover:border-dorado disabled:opacity-40"
        >
          + Ítem libre
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((it, idx) => (
          <div key={it._k} className="flex flex-wrap items-center gap-2.5 text-[12.5px]">
            {it.material_id !== null ? (
              <select
                className={`${inputCls} w-full max-w-[420px] sm:w-auto sm:min-w-[300px]`}
                value={it.material_id}
                onChange={(e) =>
                  setItems((xs) =>
                    xs.map((x, i) => (i === idx ? { ...x, material_id: e.target.value } : x)),
                  )
                }
              >
                {delTipo.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={`${inputCls} w-full max-w-[420px] sm:w-auto sm:min-w-[300px]`}
                placeholder="Descripción del material nuevo…"
                value={it.descripcion ?? ""}
                onChange={(e) =>
                  setItems((xs) =>
                    xs.map((x, i) => (i === idx ? { ...x, descripcion: e.target.value } : x)),
                  )
                }
              />
            )}
            <label className="flex items-center gap-1.5">
              cant
              <input
                type="number"
                min={1}
                className={`${inputCls} w-[84px] py-1`}
                value={it.cantidad}
                onChange={(e) =>
                  setItems((xs) =>
                    xs.map((x, i) =>
                      i === idx ? { ...x, cantidad: Number(e.target.value) || 1 } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))}
              className="text-[16px] text-neutro hover:text-rojo"
              aria-label="Quitar"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-bold text-neutro">
          NOTAS
          <input
            className={inputCls}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Contexto para el comprador…"
          />
        </label>
        <button
          type="button"
          disabled={guardando || !tipo || items.length === 0}
          onClick={() => void guardar()}
          className="rounded-pill bg-carbon px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {guardando ? "Creando…" : "Crear solicitud"}
        </button>
      </div>
    </div>
  );
}
