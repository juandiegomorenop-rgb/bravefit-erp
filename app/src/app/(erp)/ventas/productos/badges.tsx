/**
 * Piezas visuales compartidas por la lista (grid) y el detalle del
 * Catálogo Maestro. Sin estado: sirven igual en server y client.
 */

import {
  CLASIFICACION_DESCRIPCION,
  CLASIFICACION_LABEL,
} from "@/lib/data/productos";
import type { Producto } from "@/lib/types/db";

/** Colores distintos por clasificación productiva. */
const ESTILO_CLASIFICACION: Record<Producto["clasificacion"], string> = {
  MTS: "bg-verde-bg text-verde",
  ATO: "bg-azul-bg text-azul",
  MTO: "bg-ambar-bg text-ambar",
};

export function BadgeClasificacion({
  clasificacion,
  larga = false,
}: {
  clasificacion: Producto["clasificacion"];
  /** true: muestra la etiqueta completa ("MTO · Fabricación a pedido"). */
  larga?: boolean;
}) {
  return (
    <span
      title={CLASIFICACION_DESCRIPCION[clasificacion]}
      className={`whitespace-nowrap rounded-pill px-2 py-0.5 text-[10px] font-bold ${ESTILO_CLASIFICACION[clasificacion]}`}
    >
      {larga ? CLASIFICACION_LABEL[clasificacion] : clasificacion}
    </span>
  );
}

export function BadgeOrigenProducto({ origen }: { origen: Producto["origen"] }) {
  return origen === "propio" ? (
    <span className="whitespace-nowrap rounded-pill bg-neutro-bg px-2 py-0.5 text-[10px] font-bold text-neutro">
      Propio
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-pill border border-aviso-borde bg-aviso px-2 py-0.5 text-[10px] font-bold text-aviso-texto">
      Comercializado
    </span>
  );
}

/** ES RACK: dorado — prioridad de display en toda la app. */
export function BadgeEsRack() {
  return (
    <span className="whitespace-nowrap rounded-pill bg-dorado px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
      Rack
    </span>
  );
}

/** Iniciales para el placeholder de foto (máx. 2 palabras). */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter((w) => /[\p{L}\d]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Foto del producto o placeholder con iniciales sobre dorado suave. */
export function FotoProducto({
  producto,
  clase,
  grande = false,
}: {
  producto: Producto;
  /** Clases de tamaño/layout del contenedor. */
  clase: string;
  grande?: boolean;
}) {
  if (producto.imagen_url) {
    return (
      <div className={`grid place-items-center bg-sutil ${clase}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={producto.imagen_url}
          alt={producto.nombre}
          className="h-full w-full object-contain p-3"
        />
      </div>
    );
  }
  return (
    <div className={`grid place-items-center bg-dorado-suave ${clase}`}>
      <span
        className={`font-extrabold tracking-wide text-dorado-oscuro ${
          grande ? "text-[56px]" : "text-[28px]"
        }`}
      >
        {iniciales(producto.nombre)}
      </span>
    </div>
  );
}
