"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLASIFICACION_DESCRIPCION } from "@/lib/data/productos";
import type { CategoriaProducto } from "@/lib/data/productos";
import { formatCOP, formatFecha } from "@/lib/formato";
import type { Producto } from "@/lib/types/db";
import { guardarProducto } from "../actions";

/**
 * Ficha del producto con edición en línea. Antes el catálogo solo se
 * podía tocar por SQL, así que mantener la lista de precios al día
 * dependía de un script: ahora un Admin edita precio, medidas y datos
 * desde el navegador. El SKU no se edita (es la llave de Shopify/Siigo
 * y de los scripts de carga).
 */
export function FichaProducto({
  producto,
  categoria,
  categorias,
}: {
  producto: Producto;
  categoria: CategoriaProducto;
  categorias: CategoriaProducto[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState(() => desdeProducto(producto));

  function abrir() {
    setF(desdeProducto(producto));
    setError(null);
    setEditando(true);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const r = await guardarProducto(producto.id, {
      nombre: f.nombre,
      descripcion: f.descripcion || null,
      categoria_id: Number(f.categoria_id),
      origen: f.origen,
      precio_lista: aNumero(f.precio_lista) ?? 0,
      costo_estandar: aNumero(f.costo_estandar),
      ancho_cm: aNumero(f.ancho_cm),
      profundidad_cm: aNumero(f.profundidad_cm),
      alto_cm: aNumero(f.alto_cm),
      peso_kg: aNumero(f.peso_kg),
      sku_siigo: f.sku_siigo || null,
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEditando(false);
    router.refresh();
  }

  /* ---------------- Modo lectura ---------------- */
  if (!editando) {
    const dimsBase = [
      producto.ancho_cm ? `Ancho ${producto.ancho_cm} cm` : null,
      producto.profundidad_cm ? `Fondo ${producto.profundidad_cm} cm` : null,
      producto.alto_cm ? `Alto ${producto.alto_cm} cm` : null,
    ].filter(Boolean);

    return (
      <>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[13px] text-neutro">Precio de lista</span>
            <b
              className={`text-[26px] font-extrabold tracking-tight ${
                producto.precio_lista > 0
                  ? "text-dorado-oscuro"
                  : "text-rojo"
              }`}
            >
              {formatCOP(producto.precio_lista)}
              <span className="ml-2 text-[11px] font-semibold text-neutro">
                {producto.precio_lista > 0 ? "IVA incluido (19%)" : "sin precio"}
              </span>
            </b>
          </div>
          <div className="mt-3 rounded-input bg-sutil px-3.5 py-2.5 text-[12.5px] leading-relaxed text-neutro">
            <b className="text-carbon">{producto.clasificacion}:</b>{" "}
            {CLASIFICACION_DESCRIPCION[producto.clasificacion]}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 rounded-card border border-borde bg-card px-5 py-4 text-[13px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold">Ficha técnica</h2>
            <button
              type="button"
              onClick={abrir}
              className="rounded-pill border border-borde bg-card px-3 py-1 text-[12px] font-semibold hover:border-dorado"
            >
              ✎ Editar ficha
            </button>
          </div>
          <Dato label="Categoría" valor={categoria.nombre} />
          <Dato
            label="Origen"
            valor={
              producto.origen === "propio"
                ? "Fabricación propia"
                : "Comercializado"
            }
          />
          <Dato
            label="Dimensiones base"
            valor={dimsBase.length > 0 ? dimsBase.join(" · ") : "—"}
          />
          <Dato
            label="Peso"
            valor={producto.peso_kg ? `${producto.peso_kg} kg` : "—"}
          />
          <Dato
            label="Costo estándar"
            valor={
              producto.costo_estandar ? formatCOP(producto.costo_estandar) : "—"
            }
          />
          <Dato
            label="SKU Siigo"
            valor={producto.sku_siigo ?? "—"}
          />
          <Dato
            label="Shopify"
            valor={producto.shopify_product_id ? "Vinculado" : "Sin vincular"}
          />
          <Dato label="Creado" valor={formatFecha(new Date(producto.creado_en))} />
          {producto.descripcion && (
            <p className="mt-1 leading-relaxed text-neutro">
              {producto.descripcion}
            </p>
          )}
        </div>
      </>
    );
  }

  /* ---------------- Modo edición ---------------- */
  return (
    <form
      onSubmit={(e) => void enviar(e)}
      className="flex flex-col gap-3 rounded-card border border-dorado bg-card px-5 py-4 text-[13px]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold">Editar ficha</h2>
        <span className="text-[11.5px] text-neutro">
          SKU <b className="text-carbon">{producto.sku}</b> · no editable
        </span>
      </div>

      <Campo label="Nombre">
        <input
          value={f.nombre}
          onChange={(e) => setF({ ...f, nombre: e.target.value })}
          required
          className={ENTRADA}
        />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Precio de lista (COP, IVA incl.)">
          <input
            value={f.precio_lista}
            onChange={(e) => setF({ ...f, precio_lista: e.target.value })}
            inputMode="numeric"
            placeholder="0"
            className={ENTRADA}
          />
        </Campo>
        <Campo label="Costo estándar (COP)">
          <input
            value={f.costo_estandar}
            onChange={(e) => setF({ ...f, costo_estandar: e.target.value })}
            inputMode="numeric"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Categoría">
          <select
            value={f.categoria_id}
            onChange={(e) => setF({ ...f, categoria_id: e.target.value })}
            className={ENTRADA}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Origen">
          <select
            value={f.origen}
            onChange={(e) =>
              setF({
                ...f,
                origen: e.target.value as "propio" | "comercializado",
              })
            }
            className={ENTRADA}
          >
            <option value="propio">Fabricación propia</option>
            <option value="comercializado">Comercializado</option>
          </select>
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Campo label="Ancho (cm)">
          <input
            value={f.ancho_cm}
            onChange={(e) => setF({ ...f, ancho_cm: e.target.value })}
            inputMode="decimal"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
        <Campo label="Fondo (cm)">
          <input
            value={f.profundidad_cm}
            onChange={(e) => setF({ ...f, profundidad_cm: e.target.value })}
            inputMode="decimal"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
        <Campo label="Alto (cm)">
          <input
            value={f.alto_cm}
            onChange={(e) => setF({ ...f, alto_cm: e.target.value })}
            inputMode="decimal"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
        <Campo label="Peso (kg)">
          <input
            value={f.peso_kg}
            onChange={(e) => setF({ ...f, peso_kg: e.target.value })}
            inputMode="decimal"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
      </div>

      <Campo label="SKU Siigo">
        <input
          value={f.sku_siigo}
          onChange={(e) => setF({ ...f, sku_siigo: e.target.value })}
          placeholder="Sin vincular"
          className={ENTRADA}
        />
      </Campo>

      <Campo label="Descripción">
        <textarea
          value={f.descripcion}
          onChange={(e) => setF({ ...f, descripcion: e.target.value })}
          rows={3}
          className={`${ENTRADA} resize-y`}
        />
      </Campo>

      {error && (
        <p className="rounded-input bg-rojo-bg px-3 py-2 text-[12.5px] font-semibold text-rojo">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-input bg-carbon px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#414141] disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          disabled={guardando}
          className="rounded-input border border-borde bg-card px-4 py-2.5 text-[13px] font-semibold hover:border-dorado disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

const ENTRADA =
  "w-full min-w-0 rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

function desdeProducto(p: Producto) {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    categoria_id: String(p.categoria_id),
    origen: p.origen,
    precio_lista: String(p.precio_lista ?? 0),
    costo_estandar: p.costo_estandar === null ? "" : String(p.costo_estandar),
    ancho_cm: p.ancho_cm === null ? "" : String(p.ancho_cm),
    profundidad_cm: p.profundidad_cm === null ? "" : String(p.profundidad_cm),
    alto_cm: p.alto_cm === null ? "" : String(p.alto_cm),
    peso_kg: p.peso_kg === null ? "" : String(p.peso_kg),
    sku_siigo: p.sku_siigo ?? "",
  };
}

/** "1.250.000" / "1250000" / "" → número o null. */
function aNumero(v: string): number | null {
  const limpio = v.replace(/[^0-9.,-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpio.trim()) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11.5px] font-semibold text-neutro">{label}</span>
      {children}
    </label>
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
