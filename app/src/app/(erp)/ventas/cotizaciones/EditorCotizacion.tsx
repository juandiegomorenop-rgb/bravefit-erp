"use client";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  calcularTotales,
  totalLinea,
  type CotizacionItemConProducto,
} from "@/lib/cotizacion-logic";
import {
  vendedorPorDefecto,
  type CotizacionInput,
  type CotizacionItemInput,
} from "@/lib/data/crm-cotizaciones";
import { COLORES_ESTANDAR } from "@/lib/data/ops";
import { formatCOP } from "@/lib/formato";
import type {
  Cliente,
  Producto,
  ProductoDimension,
  RecargoAplicado,
  Usuario,
} from "@/lib/types/db";
import {
  actualizarCotizacion,
  crearClienteCatalogo,
  crearCotizacion,
  crearProductoCatalogo,
} from "./actions";

interface Props {
  clientes: Cliente[];
  vendedores: Usuario[];
  productos: Producto[];
  dimensiones: ProductoDimension[];
  categorias: { id: number; nombre: string; orden: number }[];
  /** Presente al editar un borrador existente. */
  cotizacionId?: string;
  numero?: string;
  inicial?: CotizacionInput;
  /** Cliente/vendedor preseleccionados al cotizar desde el CRM. */
  prefill?: { cliente_id: string; vendedor_id: string };
  /** Oportunidad del embudo a la que se vinculará esta cotización. */
  oportunidadId?: string;
}

interface Linea extends CotizacionItemInput {
  _key: string;
  /** true cuando el usuario fijó el precio a mano: se deja de recalcular. */
  _precioManual: boolean;
}

const RECARGO_ATO_PCT = 8; // Color no estándar (seed recargos)

let seq = 0;
const nuevaKey = () => `ln-${++seq}-${Date.now()}`;

/**
 * Fila arrastrable del editor: handle ⠿ + número de ítem. El orden
 * del array `lineas` es el que se guarda (cotizacion_items.orden).
 */
function SortableLinea({
  id,
  indice,
  children,
}: {
  id: string;
  indice: number;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
      className={`flex gap-2.5 rounded-[10px] border bg-sutil p-3.5 ${
        isDragging ? "relative z-10 border-dorado shadow-lg" : "border-borde"
      }`}
    >
      <div className="flex flex-col items-center gap-1.5 pt-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-[16px] leading-none text-neutro hover:text-carbon active:cursor-grabbing"
          aria-label={`Arrastrar para reordenar el ítem ${indice + 1}`}
          title="Arrastrar para reordenar"
        >
          ⠿
        </button>
        <span className="rounded bg-neutro-bg px-1.5 py-0.5 text-[10.5px] font-bold text-neutro">
          #{indice + 1}
        </span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Editor de cotizaciones — crea/edita BORRADORES con la lógica del
 * formato oficial: precio sugerido = lista + $/cm extra por dimensión
 * + recargo ATO 8% si el color no es estándar; descuento POR LÍNEA;
 * ítems libres (transporte) con IVA opcional; totales en vivo con
 * grupos PP 60/40 vs PC 100%.
 */
export function EditorCotizacion({
  clientes,
  vendedores,
  productos,
  dimensiones,
  categorias,
  cotizacionId,
  numero,
  inicial,
  prefill,
  oportunidadId,
}: Props) {
  const router = useRouter();
  // catálogo local: crece cuando se crea un producto desde el editor
  const [prods, setProds] = useState<Producto[]>(productos);
  const [cab, setCab] = useState<Omit<CotizacionInput, "items">>({
    cliente_id: inicial?.cliente_id ?? prefill?.cliente_id ?? "",
    vendedor_id:
      inicial?.vendedor_id ||
      prefill?.vendedor_id ||
      vendedorPorDefecto(vendedores),
    origen: inicial?.origen ?? "whatsapp",
    segmento: inicial?.segmento ?? "B2B",
    no_facturar: inicial?.no_facturar ?? false,
    pago_anticipado_completo: inicial?.pago_anticipado_completo ?? false,
    descuento_pct: inicial?.descuento_pct ?? 0,
    tiempo_entrega:
      inicial?.tiempo_entrega ??
      "Fabricados: 45 días hábiles · Comercializados: 5 días hábiles",
    notas: inicial?.notas ?? null,
  });
  const [lineas, setLineas] = useState<Linea[]>(
    (inicial?.items ?? []).map((i) => ({
      ...i,
      _key: nuevaKey(),
      _precioManual: true,
    })),
  );
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Clientes: buscador + alta rápida (regla de Juan: nada de lista gigante)
  const [clis, setClis] = useState<Cliente[]>(clientes);
  const [busquedaCli, setBusquedaCli] = useState("");
  const [nuevoCli, setNuevoCli] = useState<null | {
    nombre: string;
    tipo: "persona" | "empresa";
    nit_cedula: string;
    telefono: string;
  }>(null);
  const [creandoCli, setCreandoCli] = useState(false);
  const clienteSel = clis.find((c) => c.id === cab.cliente_id) ?? null;
  const clientesEncontrados = useMemo(() => {
    const q = busquedaCli.trim().toLowerCase();
    if (!q) return [];
    const qDigitos = q.replace(/\D/g, "");
    return clis
      .filter(
        (c) =>
          c.activo &&
          (c.nombre.toLowerCase().includes(q) ||
            (c.nit_cedula ?? "").toLowerCase().includes(q) ||
            // buscar también por teléfono evita crear duplicados
            (qDigitos.length >= 4 &&
              (c.telefono ?? "").replace(/\D/g, "").includes(qDigitos))),
      )
      .slice(0, 6);
  }, [busquedaCli, clis]);

  async function crearClienteNuevo() {
    if (!nuevoCli || creandoCli) return;
    if (!nuevoCli.nombre.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    setCreandoCli(true);
    setError(null);
    const r = await crearClienteCatalogo({
      nombre: nuevoCli.nombre,
      tipo: nuevoCli.tipo,
      nit_cedula: nuevoCli.nit_cedula || null,
      telefono: nuevoCli.telefono || null,
    });
    setCreandoCli(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setClis((cs) => [...cs, r.cliente]);
    setCab({ ...cab, cliente_id: r.cliente.id });
    setNuevoCli(null);
    setBusquedaCli("");
  }

  // Tiempo de entrega en DÍAS (regla de Juan): dos cajas numéricas.
  const [diasFab, setDiasFab] = useState<string>(() => {
    const m = /Fabricados:\s*(\d+)/.exec(inicial?.tiempo_entrega ?? "");
    return m ? m[1] : "45";
  });
  const [diasCom, setDiasCom] = useState<string>(() => {
    const m = /Comercializados:\s*(\d+)/.exec(inicial?.tiempo_entrega ?? "");
    return m ? m[1] : "5";
  });
  function setDias(fab: string, com: string) {
    setDiasFab(fab);
    setDiasCom(com);
    const partes: string[] = [];
    if (fab.trim()) partes.push(`Fabricados: ${fab.trim()} días hábiles`);
    if (com.trim()) partes.push(`Comercializados: ${com.trim()} días hábiles`);
    setCab((c) => ({ ...c, tiempo_entrega: partes.join(" · ") || null }));
  }

  // Alta rápida de producto (nace en la BD = fuente de la verdad)
  const [nuevoProd, setNuevoProd] = useState<null | {
    nombre: string;
    sku: string;
    categoria_id: number;
    origen: "propio" | "comercializado";
    precio: string;
  }>(null);
  const [creandoProd, setCreandoProd] = useState(false);

  async function crearProductoNuevo() {
    if (!nuevoProd || creandoProd) return;
    const precio = Number(nuevoProd.precio);
    if (!nuevoProd.nombre.trim() || !nuevoProd.sku.trim()) {
      setError("Nombre y SKU son obligatorios para crear el producto.");
      return;
    }
    if (!Number.isFinite(precio) || precio < 0) {
      setError("El precio del producto nuevo no es válido.");
      return;
    }
    setCreandoProd(true);
    setError(null);
    const r = await crearProductoCatalogo({
      nombre: nuevoProd.nombre,
      sku: nuevoProd.sku,
      categoria_id: nuevoProd.categoria_id,
      origen: nuevoProd.origen,
      precio_lista: precio,
    });
    setCreandoProd(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setProds((ps) => [...ps, r.producto]);
    agregarProducto(r.producto);
    setNuevoProd(null);
  }

  const dimsDe = (producto_id: string) =>
    dimensiones.filter((d) => d.producto_id === producto_id);

  /** Precio sugerido + recargos según overrides y color (formato oficial). */
  function sugerir(
    p: Producto,
    alto: number | null,
    fondo: number | null,
    color: string | null,
  ): { precio: number; recargos: RecargoAplicado[] } {
    const recargos: RecargoAplicado[] = [];
    let base = p.precio_lista;
    for (const [eje, valor] of [
      ["alto", alto],
      ["fondo", fondo],
    ] as const) {
      const d = dimsDe(p.id).find((x) => x.eje === eje);
      if (d && valor !== null && valor > d.default_cm) {
        const monto = Math.round(
          (valor - d.default_cm) * d.precio_por_cm_extra,
        );
        base += monto;
        recargos.push({
          recargo_id: null,
          nombre: `${eje === "alto" ? "Alto" : "Fondo"} ${valor} cm (+${valor - d.default_cm} cm × ${formatCOP(d.precio_por_cm_extra)})`,
          tipo: "fijo",
          valor: monto,
          monto,
        });
      }
    }
    const colorLimpio = color?.trim();
    if (
      colorLimpio &&
      !COLORES_ESTANDAR.some(
        (c) => c.toLowerCase() === colorLimpio.toLowerCase(),
      )
    ) {
      const monto = Math.round((base * RECARGO_ATO_PCT) / 100);
      recargos.push({
        recargo_id: 1,
        nombre: "Color no estándar (ATO)",
        tipo: "pct",
        valor: RECARGO_ATO_PCT,
        monto,
      });
      base += monto;
    }
    return { precio: base, recargos };
  }

  function agregarProducto(p: Producto) {
    const { precio, recargos } = sugerir(p, null, null, p.color_default);
    setLineas((ls) => [
      ...ls,
      {
        _key: nuevaKey(),
        _precioManual: false,
        producto_id: p.id,
        descripcion: null,
        es_transporte: false,
        aplica_iva: true,
        cantidad: 1,
        precio_unit: precio,
        descuento_pct: 0,
        alto_override_cm: null,
        fondo_override_cm: null,
        // Regla de Juan: los fabricados salen NEGRO por defecto.
        color: p.color_default ?? (p.origen === "propio" ? "Negro" : null),
        recargos,
      },
    ]);
    setBusqueda("");
  }

  function agregarLibre(transporte: boolean) {
    setLineas((ls) => [
      ...ls,
      {
        _key: nuevaKey(),
        _precioManual: true,
        producto_id: null,
        descripcion: transporte ? "Transporte" : "",
        es_transporte: transporte,
        aplica_iva: !transporte, // transporte suele ir excluido; editable
        cantidad: 1,
        precio_unit: 0,
        descuento_pct: 0,
        alto_override_cm: null,
        fondo_override_cm: null,
        color: null,
        recargos: [],
      },
    ]);
  }

  // Drag & drop: reordenar líneas (el array es la fuente del orden)
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  function alSoltarLinea(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setLineas((ls) => {
      const desde = ls.findIndex((l) => l._key === active.id);
      const hasta = ls.findIndex((l) => l._key === over.id);
      if (desde < 0 || hasta < 0) return ls;
      return arrayMove(ls, desde, hasta);
    });
  }

  function actualizarLinea(key: string, patch: Partial<Linea>) {
    setLineas((ls) =>
      ls.map((l) => {
        if (l._key !== key) return l;
        const next = { ...l, ...patch };
        // recalcular precio sugerido salvo que el precio sea manual
        const p = prods.find((x) => x.id === next.producto_id);
        const cambioDeConfig =
          "alto_override_cm" in patch ||
          "fondo_override_cm" in patch ||
          "color" in patch;
        if (p && cambioDeConfig && !next._precioManual) {
          const s = sugerir(
            p,
            next.alto_override_cm,
            next.fondo_override_cm,
            next.color,
          );
          next.precio_unit = s.precio;
          next.recargos = s.recargos;
        }
        return next;
      }),
    );
  }

  const itemsConProducto: CotizacionItemConProducto[] = useMemo(
    () =>
      lineas.map((l) => ({
        id: l._key,
        cotizacion_id: cotizacionId ?? "nueva",
        producto_id: l.producto_id,
        descripcion: l.descripcion,
        es_transporte: l.es_transporte,
        aplica_iva: l.aplica_iva,
        cantidad: l.cantidad,
        precio_unit: l.precio_unit,
        descuento_pct: l.descuento_pct,
        alto_override_cm: l.alto_override_cm,
        fondo_override_cm: l.fondo_override_cm,
        color: l.color,
        recargos: l.recargos,
        producto: prods.find((p) => p.id === l.producto_id) ?? null,
      })),
    [lineas, prods, cotizacionId],
  );
  const totales = useMemo(
    () => calcularTotales(itemsConProducto, cab),
    [itemsConProducto, cab],
  );

  const encontrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return prods
      .filter(
        (p) =>
          p.activo &&
          (p.nombre.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [busqueda, prods]);

  async function guardar() {
    setError(null);
    setGuardando(true);
    const input: CotizacionInput = {
      ...cab,
      tiempo_entrega: cab.tiempo_entrega?.trim() || null,
      notas: cab.notas?.trim() || null,
      items: lineas.map(({ _key, _precioManual, ...i }) => i),
    };
    const r = cotizacionId
      ? await actualizarCotizacion(cotizacionId, input)
      : await crearCotizacion(input, oportunidadId);
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(`/ventas/cotizaciones/${cotizacionId ?? r.id}`);
  }

  const inputCls =
    "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

  return (
    <div className="mx-auto max-w-[980px]">
      <div className="mb-5">
        <p className="text-[12.5px] text-neutro">Ventas / Cotizaciones /</p>
        <h1 className="text-[26px] font-extrabold tracking-tight">
          {cotizacionId ? `Editar ${numero} (borrador)` : "Nueva cotización"}
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-rojo/30 bg-rojo-bg px-4 py-3 text-[13px] font-semibold text-rojo">
          {error}
        </div>
      )}

      {/* ---- Cabecera ---- */}
      <div className="rounded-card border border-borde bg-card p-5">
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
            CLIENTE *
            {clienteSel ? (
              <span className="flex items-center gap-2 rounded-input border border-borde bg-sutil px-3 py-2 text-[13px]">
                <b className="min-w-0 flex-1 truncate">{clienteSel.nombre}</b>
                <button
                  type="button"
                  onClick={() => setCab({ ...cab, cliente_id: "" })}
                  className="text-[11.5px] font-semibold text-dorado-oscuro hover:underline"
                >
                  cambiar
                </button>
              </span>
            ) : (
              <span className="relative">
                <input
                  className={`${inputCls} w-full`}
                  placeholder="Buscar por nombre o cédula/NIT…"
                  value={busquedaCli}
                  onChange={(e) => setBusquedaCli(e.target.value)}
                />
                {busquedaCli.trim() && (
                  <span className="absolute z-20 mt-1 block w-full overflow-hidden rounded-card border border-borde bg-card shadow-lg">
                    {clientesEncontrados.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCab({ ...cab, cliente_id: c.id });
                          setBusquedaCli("");
                        }}
                        className="block w-full px-3 py-2 text-left hover:bg-sutil"
                      >
                        <span className="block text-[13px] font-semibold">
                          {c.nombre}
                        </span>
                        <span className="text-[11px] font-normal text-neutro">
                          {c.nit_cedula ?? "sin documento"}
                          {c.telefono ? ` · ${c.telefono}` : ""}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setNuevoCli({
                          nombre: busquedaCli.trim(),
                          tipo: "persona",
                          nit_cedula: "",
                          telefono: "",
                        })
                      }
                      className="block w-full border-t border-borde bg-dorado-suave px-3 py-2 text-left text-[12.5px] font-semibold text-dorado-oscuro hover:bg-dorado/20"
                    >
                      ＋ Crear cliente “{busquedaCli.trim()}”
                    </button>
                  </span>
                )}
              </span>
            )}
            {nuevoCli && (
              <span className="mt-1 flex flex-col gap-1.5 rounded-input border border-dorado bg-dorado-suave p-2.5">
                <input
                  className={inputCls}
                  placeholder="Nombre / Razón social *"
                  value={nuevoCli.nombre}
                  onChange={(e) =>
                    setNuevoCli({ ...nuevoCli, nombre: e.target.value })
                  }
                />
                <span className="flex gap-1.5">
                  <select
                    aria-label="Tipo de cliente"
                    className={`${inputCls} flex-1`}
                    value={nuevoCli.tipo}
                    onChange={(e) =>
                      setNuevoCli({
                        ...nuevoCli,
                        tipo: e.target.value as "persona" | "empresa",
                      })
                    }
                  >
                    <option value="persona">Persona</option>
                    <option value="empresa">Empresa</option>
                  </select>
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="Cédula / NIT"
                    value={nuevoCli.nit_cedula}
                    onChange={(e) =>
                      setNuevoCli({ ...nuevoCli, nit_cedula: e.target.value })
                    }
                  />
                </span>
                <input
                  className={inputCls}
                  placeholder="Teléfono"
                  value={nuevoCli.telefono}
                  onChange={(e) =>
                    setNuevoCli({ ...nuevoCli, telefono: e.target.value })
                  }
                />
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={creandoCli}
                    onClick={() => void crearClienteNuevo()}
                    className="rounded-pill bg-carbon px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-40"
                  >
                    {creandoCli ? "Creando…" : "Crear cliente"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNuevoCli(null)}
                    className="rounded-pill px-3 py-1.5 text-[12px] font-semibold text-neutro hover:bg-neutro-bg"
                  >
                    Cancelar
                  </button>
                </span>
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
            VENDEDOR *
            <select
              className={inputCls}
              value={cab.vendedor_id}
              onChange={(e) => setCab({ ...cab, vendedor_id: e.target.value })}
            >
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
            FUENTE DEL LEAD * (define la sigla del número)
            <select
              className={inputCls}
              value={cab.origen ?? "whatsapp"}
              disabled={!!cotizacionId}
              title={
                cotizacionId
                  ? "La fuente se fija al crear (el número ya lleva su sigla)"
                  : undefined
              }
              onChange={(e) =>
                setCab({
                  ...cab,
                  origen: e.target.value as NonNullable<
                    CotizacionInput["origen"]
                  >,
                })
              }
            >
              <option value="whatsapp">WhatsApp → COT_WA_####</option>
              <option value="showroom">Showroom → COT_SR_####</option>
              <option value="shopify">Shopify → COT_SPFY_####</option>
              <option value="planner">Planner → COT_BFP_####</option>
            </select>
          </label>
          <div className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
            SEGMENTO *
            <div className="flex gap-1.5">
              {(["B2B", "B2C"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCab({ ...cab, segmento: s })}
                  className={`flex-1 rounded-input border px-3 py-2 text-[13px] font-bold transition-colors ${
                    cab.segmento === s
                      ? "border-carbon bg-carbon text-white"
                      : "border-borde bg-card text-neutro hover:border-dorado"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro lg:col-span-2">
            TIEMPO DE ENTREGA EN DÍAS HÁBILES (sale bajo el total del documento)
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-neutro">
                  FABRICADOS
                </span>
                <input
                  type="number"
                  min={0}
                  className={`${inputCls} w-20 text-right`}
                  value={diasFab}
                  onChange={(e) => setDias(e.target.value, diasCom)}
                />
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-neutro">
                  COMERCIALIZADOS
                </span>
                <input
                  type="number"
                  min={0}
                  className={`${inputCls} w-20 text-right`}
                  value={diasCom}
                  onChange={(e) => setDias(diasFab, e.target.value)}
                />
              </span>
              <span className="text-[11px] text-neutro">
                {cab.tiempo_entrega}
              </span>
            </span>
          </label>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={cab.no_facturar}
                onChange={(e) =>
                  setCab({ ...cab, no_facturar: e.target.checked })
                }
              />
              No facturar (no va a Siigo)
            </label>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={cab.pago_anticipado_completo}
                onChange={(e) =>
                  setCab({
                    ...cab,
                    pago_anticipado_completo: e.target.checked,
                    descuento_pct: e.target.checked
                      ? cab.descuento_pct || 5
                      : 0,
                  })
                }
              />
              Pago 100% anticipado — descuento global
              <input
                type="number"
                min={0}
                max={50}
                disabled={!cab.pago_anticipado_completo}
                value={cab.descuento_pct}
                onChange={(e) =>
                  setCab({ ...cab, descuento_pct: Number(e.target.value) || 0 })
                }
                className={`${inputCls} w-[64px] py-1 disabled:opacity-40`}
              />
              %
            </label>
          </div>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
          NOTAS PARA EL CLIENTE (salen en el documento, bloque CLIENTE)
          <textarea
            rows={2}
            className={inputCls}
            value={cab.notas ?? ""}
            onChange={(e) => setCab({ ...cab, notas: e.target.value })}
          />
        </label>
      </div>

      {/* ---- Ítems ---- */}
      <div className="mt-5 rounded-card border border-borde bg-card p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[280px] flex-1">
            <input
              className={`${inputCls} w-full`}
              placeholder="Buscar producto por nombre o SKU y agregarlo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {encontrados.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-card border border-borde bg-card shadow-lg">
                {encontrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregarProducto(p)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-sutil"
                  >
                    {p.imagen_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imagen_url}
                        alt=""
                        className="h-9 w-9 object-contain"
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded bg-neutro-bg text-[10px] font-bold text-neutro">
                        {p.sku.slice(3, 5)}
                      </span>
                    )}
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold">
                        {p.nombre}
                      </span>
                      <span className="text-[11px] text-neutro">
                        {p.sku} · {p.origen === "comercializado" ? "PC" : "PP"}
                      </span>
                    </span>
                    <b className="text-[12.5px]">{formatCOP(p.precio_lista)}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => agregarLibre(true)}
            className="rounded-pill border border-borde bg-card px-4 py-2 text-[12.5px] font-semibold hover:border-dorado"
          >
            + Transporte
          </button>
          <button
            type="button"
            onClick={() => agregarLibre(false)}
            className="rounded-pill border border-borde bg-card px-4 py-2 text-[12.5px] font-semibold hover:border-dorado"
          >
            + Ítem libre
          </button>
          <button
            type="button"
            onClick={() =>
              setNuevoProd({
                nombre: busqueda.trim(),
                sku: "",
                categoria_id: categorias[0]?.id ?? 1,
                origen: "propio",
                precio: "",
              })
            }
            className="rounded-pill border border-dorado bg-dorado-suave px-4 py-2 text-[12.5px] font-semibold text-dorado-oscuro hover:border-dorado-oscuro"
          >
            ＋ Crear producto
          </button>
        </div>

        {/* Alta rápida: el producto nace en el catálogo (fuente de la verdad) */}
        {nuevoProd && (
          <div className="mt-3 rounded-[10px] border border-dorado bg-dorado-suave p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-dorado-oscuro">
              Crear producto en el catálogo — queda disponible para futuras
              cotizaciones, OPs e inventario
            </p>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6">
              <input
                className={`${inputCls} lg:col-span-2`}
                placeholder="Nombre del producto *"
                value={nuevoProd.nombre}
                onChange={(e) =>
                  setNuevoProd({ ...nuevoProd, nombre: e.target.value })
                }
              />
              <input
                className={inputCls}
                placeholder="SKU * (ej. 3NuevoProd)"
                value={nuevoProd.sku}
                onChange={(e) =>
                  setNuevoProd({ ...nuevoProd, sku: e.target.value })
                }
              />
              <select
                aria-label="Categoría del producto nuevo"
                className={inputCls}
                value={nuevoProd.categoria_id}
                onChange={(e) =>
                  setNuevoProd({
                    ...nuevoProd,
                    categoria_id: Number(e.target.value),
                  })
                }
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <select
                aria-label="Tipo del producto nuevo"
                className={inputCls}
                value={nuevoProd.origen}
                onChange={(e) =>
                  setNuevoProd({
                    ...nuevoProd,
                    origen: e.target.value as "propio" | "comercializado",
                  })
                }
              >
                <option value="propio">Propio (PP 60/40)</option>
                <option value="comercializado">Comercializado (PC 100%)</option>
              </select>
              <input
                className={inputCls}
                type="number"
                min={0}
                placeholder="Precio lista (IVA incl.)"
                value={nuevoProd.precio}
                onChange={(e) =>
                  setNuevoProd({ ...nuevoProd, precio: e.target.value })
                }
              />
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                disabled={creandoProd}
                onClick={() => void crearProductoNuevo()}
                className="rounded-pill bg-carbon px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-40"
              >
                {creandoProd ? "Creando…" : "Crear y agregar a la cotización"}
              </button>
              <button
                type="button"
                onClick={() => setNuevoProd(null)}
                className="rounded-pill px-3 py-1.5 text-[12.5px] font-semibold text-neutro hover:bg-neutro-bg"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {lineas.length === 0 && (
          <p className="mt-6 text-center text-[13px] text-neutro">
            Agrega productos del catálogo, transporte o ítems libres.
          </p>
        )}

        <DndContext
          sensors={sensores}
          collisionDetection={closestCenter}
          onDragEnd={alSoltarLinea}
        >
          <SortableContext
            items={lineas.map((l) => l._key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-4 space-y-3">
              {lineas.map((l, idx) => {
                const p = prods.find((x) => x.id === l.producto_id);
                const dims = p ? dimsDe(p.id) : [];
                const dAlto = dims.find((d) => d.eje === "alto");
                const dFondo = dims.find((d) => d.eje === "fondo");
                return (
                  <SortableLinea key={l._key} id={l._key} indice={idx}>
                    <div className="flex flex-wrap items-start gap-3">
                      {p?.imagen_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imagen_url}
                          alt=""
                          className="h-12 w-12 object-contain"
                        />
                      )}
                      <div className="min-w-[200px] flex-1">
                        {p ? (
                          <>
                            <b className="text-[13.5px]">{p.nombre}</b>
                            <span className="ml-2 text-[11px] text-neutro">
                              {p.sku} ·{" "}
                              {p.origen === "comercializado"
                                ? "PC 100%"
                                : "PP 60/40"}
                            </span>
                          </>
                        ) : (
                          <input
                            className={`${inputCls} w-full`}
                            placeholder="Descripción del ítem…"
                            value={l.descripcion ?? ""}
                            onChange={(e) =>
                              actualizarLinea(l._key, {
                                descripcion: e.target.value,
                              })
                            }
                          />
                        )}
                        {l.recargos.length > 0 && (
                          <p className="mt-1 text-[11px] text-dorado-oscuro">
                            {l.recargos.map((r) => r.nombre).join(" · ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setLineas((ls) => ls.filter((x) => x._key !== l._key))
                        }
                        className="text-[18px] leading-none text-neutro hover:text-rojo"
                        aria-label="Quitar ítem"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-end gap-3 text-[11.5px] font-bold text-neutro">
                      <label className="flex flex-col gap-1">
                        CANT
                        <input
                          type="number"
                          min={1}
                          className={`${inputCls} w-[72px]`}
                          value={l.cantidad}
                          onChange={(e) =>
                            actualizarLinea(l._key, {
                              cantidad: Number(e.target.value) || 1,
                            })
                          }
                        />
                      </label>
                      {dAlto && (
                        <label className="flex flex-col gap-1">
                          ALTO CM ({dAlto.min_cm}–{dAlto.max_cm}, base{" "}
                          {dAlto.default_cm})
                          <input
                            type="number"
                            min={dAlto.min_cm}
                            max={dAlto.max_cm}
                            placeholder={String(dAlto.default_cm)}
                            className={`${inputCls} w-[130px]`}
                            value={l.alto_override_cm ?? ""}
                            onChange={(e) =>
                              actualizarLinea(l._key, {
                                alto_override_cm: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                          />
                        </label>
                      )}
                      {dFondo && (
                        <label className="flex flex-col gap-1">
                          FONDO CM ({dFondo.min_cm}–{dFondo.max_cm}, base{" "}
                          {dFondo.default_cm})
                          <input
                            type="number"
                            min={dFondo.min_cm}
                            max={dFondo.max_cm}
                            placeholder={String(dFondo.default_cm)}
                            className={`${inputCls} w-[140px]`}
                            value={l.fondo_override_cm ?? ""}
                            onChange={(e) =>
                              actualizarLinea(l._key, {
                                fondo_override_cm: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                          />
                        </label>
                      )}
                      {p && (
                        <label className="flex flex-col gap-1">
                          COLOR (fuera de estándar = ATO +8%)
                          <input
                            list="colores-estandar"
                            className={`${inputCls} w-[150px]`}
                            value={l.color ?? ""}
                            onChange={(e) =>
                              actualizarLinea(l._key, {
                                color: e.target.value || null,
                              })
                            }
                          />
                        </label>
                      )}
                      <label className="flex flex-col gap-1">
                        PRECIO UNIT. (COP con IVA)
                        <input
                          type="number"
                          min={0}
                          className={`${inputCls} w-[130px] ${l._precioManual ? "border-dorado" : ""}`}
                          value={l.precio_unit}
                          onChange={(e) =>
                            actualizarLinea(l._key, {
                              precio_unit: Number(e.target.value) || 0,
                              _precioManual: true,
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        % DESC
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className={`${inputCls} w-[70px]`}
                          value={l.descuento_pct}
                          onChange={(e) =>
                            actualizarLinea(l._key, {
                              descuento_pct: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      {!p && (
                        <label className="flex items-center gap-1.5 pb-2 text-[12px] font-semibold">
                          <input
                            type="checkbox"
                            checked={l.aplica_iva}
                            onChange={(e) =>
                              actualizarLinea(l._key, {
                                aplica_iva: e.target.checked,
                              })
                            }
                          />
                          Aplica IVA
                        </label>
                      )}
                      <span className="ml-auto pb-2 text-[14px] font-extrabold text-carbon">
                        {formatCOP(totalLinea(l))}
                      </span>
                    </div>
                  </SortableLinea>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
        <datalist id="colores-estandar">
          {COLORES_ESTANDAR.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      {/* ---- Totales en vivo + guardar ---- */}
      <div className="sticky bottom-0 mt-5 rounded-card border border-borde bg-card p-4 shadow-[0_-4px_16px_rgba(0,0,0,.06)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-neutro">
            <span>
              Subtotal{" "}
              <b className="text-carbon">{formatCOP(totales.subtotal)}</b>
            </span>
            <span>
              IVA <b className="text-carbon">{formatCOP(totales.iva)}</b>
            </span>
            {totales.descuentoMonto > 0 && (
              <span>
                Descuento{" "}
                <b className="text-dorado-oscuro">
                  -{formatCOP(totales.descuentoMonto)}
                </b>
              </span>
            )}
            <span>
              Total{" "}
              <b className="text-[15px] text-dorado-oscuro">
                {formatCOP(totales.total)}
              </b>
            </span>
            <span>
              Pago inicial{" "}
              <b className="text-carbon">{formatCOP(totales.pagoInicial)}</b>
            </span>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-pill border border-borde px-5 py-2.5 text-[13.5px] font-semibold hover:border-neutro"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardar()}
              className="rounded-pill bg-carbon px-6 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
            >
              {guardando
                ? "Guardando…"
                : cotizacionId
                  ? "Guardar borrador"
                  : "Crear borrador"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
