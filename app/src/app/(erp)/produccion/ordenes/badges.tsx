/**
 * Piezas visuales compartidas por Kanban / Lista / Calendario / Detalle.
 * Sin estado: sirven igual en server y client components.
 */

import { formatFechaCorta } from "@/lib/formato";
import { parseFechaLocal, type SemaforoOp } from "@/lib/ops-logic";
import type { OrigenOp } from "@/lib/types/db";

/** Banda lateral de la tarjeta kanban según semáforo. */
export const BANDA_SEMAFORO: Record<SemaforoOp, string> = {
  ninguno: "border-l-transparent",
  amarillo: "border-l-semaforo-amarillo",
  rojo: "border-l-semaforo-rojo",
  negro: "border-l-semaforo-vencido",
};

/** Fondo de fila de la lista según semáforo (suave, no chillón). */
export const FILA_SEMAFORO: Record<SemaforoOp, string> = {
  ninguno: "bg-card hover:bg-sutil",
  amarillo: "bg-ambar-bg hover:bg-[#fbeccb]",
  rojo: "bg-rojo-bg hover:bg-[#fadfd6]",
  negro: "bg-semaforo-vencido text-white hover:bg-[#2e2e2e]",
};

/** Chip compacto del calendario según semáforo. */
export const CHIP_SEMAFORO: Record<SemaforoOp, string> = {
  ninguno: "bg-dorado-suave text-dorado-oscuro",
  amarillo: "bg-semaforo-amarillo text-semaforo-amarillo-texto",
  rojo: "bg-semaforo-rojo text-white",
  negro: "bg-semaforo-vencido text-white",
};

const ESTILO_ORIGEN: Record<string, string> = {
  shopify: "bg-azul-bg text-azul",
  whatsapp: "bg-verde-bg text-verde",
  planner: "bg-dorado-suave text-dorado-oscuro",
  cotizacion: "bg-neutro-bg text-neutro",
};

export function BadgeOrigen({ origen }: { origen: OrigenOp }) {
  return (
    <span
      className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${
        ESTILO_ORIGEN[origen.clave] ?? "bg-neutro-bg text-neutro"
      }`}
    >
      {origen.nombre}
    </span>
  );
}

/** Badge GARANTÍA: grande, rojo, prioridad visual tipo ambulancia. */
export function BadgeGarantia({ grande = false }: { grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-semaforo-rojo font-extrabold uppercase tracking-wider text-white ${
        grande ? "px-2.5 py-1 text-[12px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      Garantía
    </span>
  );
}

export function BadgeInstalacion() {
  return (
    <span className="rounded-pill bg-dorado-suave px-2 py-0.5 text-[10px] font-bold text-dorado-oscuro">
      Instalación
    </span>
  );
}

export function BadgeEsperandoProveedor() {
  return (
    <span className="rounded-pill border border-aviso-borde bg-aviso px-2 py-0.5 text-[10px] font-bold text-aviso-texto">
      Esp. proveedor
    </span>
  );
}

/**
 * Píldora de entrega: fecha pactada coloreada por semáforo,
 * o "Entregada + fecha" en verde si ya se entregó.
 */
export function PillEntrega({
  fecha_entrega_pactada,
  fecha_entregada,
  semaforo,
}: {
  fecha_entrega_pactada: string | null;
  fecha_entregada: string | null;
  semaforo: SemaforoOp;
}) {
  if (fecha_entregada) {
    return (
      <span className="whitespace-nowrap rounded-pill bg-verde-bg px-2.5 py-0.5 text-[11px] font-bold text-verde">
        Entregada {formatFechaCorta(parseFechaLocal(fecha_entregada))}
      </span>
    );
  }
  if (!fecha_entrega_pactada) {
    return <span className="text-[11px] text-neutro">Sin fecha</span>;
  }
  const estilo: Record<SemaforoOp, string> = {
    ninguno: "bg-neutro-bg text-neutro",
    amarillo: "bg-semaforo-amarillo text-semaforo-amarillo-texto",
    rojo: "bg-semaforo-rojo text-white",
    negro: "bg-semaforo-vencido text-white ring-1 ring-white/20",
  };
  return (
    <span
      className={`whitespace-nowrap rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${estilo[semaforo]}`}
    >
      {semaforo === "negro" ? "Vencida " : ""}
      {formatFechaCorta(parseFechaLocal(fecha_entrega_pactada))}
    </span>
  );
}
