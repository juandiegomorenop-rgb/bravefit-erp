/**
 * Piezas compartidas del módulo Entregas: etiquetas de mes es-CO y
 * badges. Sin estado: sirven igual en server y client components.
 */

import { ORIGEN_LABEL } from "@/lib/data/entregas";

/** "2026-03" → "mar 26" (es-CO, sin punto). */
export function mesCorto(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const corto = new Intl.DateTimeFormat("es-CO", { month: "short" })
    .format(new Date(anio, m - 1, 1))
    .replace(/\./g, "");
  return `${corto} ${String(anio).slice(2)}`;
}

/** "2026-03" → "marzo de 2026" (es-CO). */
export function mesLargo(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(new Date(anio, m - 1, 1));
}

const ESTILO_ORIGEN: Record<string, string> = {
  shopify: "bg-azul-bg text-azul",
  whatsapp: "bg-verde-bg text-verde",
  planner: "bg-dorado-suave text-dorado-oscuro",
  cotizacion: "bg-neutro-bg text-neutro",
};

export function BadgeOrigen({ clave }: { clave: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-pill px-2 py-0.5 text-[10px] font-bold ${
        ESTILO_ORIGEN[clave] ?? "bg-neutro-bg text-neutro"
      }`}
    >
      {ORIGEN_LABEL[clave] ?? clave}
    </span>
  );
}

export function BadgeInstalacion() {
  return (
    <span className="whitespace-nowrap rounded-pill bg-dorado-suave px-2 py-0.5 text-[10px] font-bold text-dorado-oscuro">
      Instalación
    </span>
  );
}
