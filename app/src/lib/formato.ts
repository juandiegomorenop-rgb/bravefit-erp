/**
 * Formato es-CO (COP y fechas en español) + semáforo de entrega de O.P.
 */

/** Formatea COP sin decimales: 28400000 → "$28.400.000". */
export function formatCOP(valor: number): string {
  const entero = Math.round(valor);
  const signo = entero < 0 ? "-" : "";
  const cifra = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Math.abs(entero));
  return `${signo}$${cifra}`;
}

/** Formatea fecha larga es-CO: new Date(2026, 2, 15) → "15 de marzo de 2026". */
export function formatFecha(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

/** Formatea fecha corta es-CO: new Date(2026, 2, 15) → "15 mar 2026". */
export function formatFechaCorta(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(fecha)
    .replace(/\./g, "");
}

/** Formatea fecha y hora cortas es-CO: "15 mar 2026, 2:05 p. m.". */
export function formatFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    year: "numeric",
  })
    .format(fecha)
    .replace(/\./g, "");
}

export type Semaforo = "ninguno" | "amarillo" | "rojo" | "vencido";

/**
 * Semáforo de entrega de O.P. — SIEMPRE calculado, nunca almacenado.
 * Días restantes hasta `fechaEntrega` (calendario, medidos a medianoche local):
 *   > 21 días  → "ninguno"
 *   15–21 días → "amarillo"   (2–3 semanas)
 *   0–14 días  → "rojo"       (menos de 2 semanas; el límite 14 es rojo)
 *   < 0 días   → "vencido"    (negro en la UI)
 */
export function semaforoEntrega(fechaEntrega: Date, hoy: Date = new Date()): Semaforo {
  const MS_DIA = 86_400_000;
  const aMedianoche = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((aMedianoche(fechaEntrega) - aMedianoche(hoy)) / MS_DIA);

  if (dias < 0) return "vencido";
  if (dias <= 14) return "rojo";
  if (dias <= 21) return "amarillo";
  return "ninguno";
}

/*
 * Tests inline (verificados manualmente):
 *   formatCOP(28400000)                    === "$28.400.000"
 *   formatCOP(0)                           === "$0"
 *   formatCOP(-1500)                       === "-$1.500"
 *   formatFecha(new Date(2026, 2, 15))     === "15 de marzo de 2026"
 *
 *   const hoy = new Date(2026, 6, 4); // 4 de julio de 2026
 *   semaforoEntrega(new Date(2026, 6, 30), hoy) === "ninguno"   // +26 días
 *   semaforoEntrega(new Date(2026, 6, 25), hoy) === "amarillo"  // +21 días
 *   semaforoEntrega(new Date(2026, 6, 19), hoy) === "amarillo"  // +15 días
 *   semaforoEntrega(new Date(2026, 6, 18), hoy) === "rojo"      // +14 días
 *   semaforoEntrega(new Date(2026, 6, 4),  hoy) === "rojo"      // hoy (0 días)
 *   semaforoEntrega(new Date(2026, 6, 3),  hoy) === "vencido"   // -1 día
 */
