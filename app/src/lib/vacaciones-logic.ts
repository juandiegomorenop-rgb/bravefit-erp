/**
 * Lógica pura de vacaciones — regla del dueño (REQUISITOS §7):
 * los días hábiles son L–V EXCLUYENDO festivos de Colombia; la fecha de
 * regreso se calcula con esa regla; se muestra cuántos días tiene cada
 * quien pendientes y cuándo cumple derecho a disfrutar.
 *
 * Ley colombiana: 15 días HÁBILES de vacaciones por año trabajado.
 * Devengados = proporcional al tiempo servido (15 × días/365).
 */

/** Festivos Colombia 2026–2027 (Ley Emiliani) — espejo de seed.sql. */
export const FESTIVOS_COLOMBIA: string[] = [
  "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
  "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
  "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02",
  "2026-11-16", "2026-12-08", "2026-12-25",
  "2027-01-01", "2027-01-11", "2027-03-22", "2027-03-25", "2027-03-26",
  "2027-05-01", "2027-05-10", "2027-05-31", "2027-06-07", "2027-07-05",
  "2027-07-20", "2027-08-07", "2027-08-16", "2027-10-18", "2027-11-01",
  "2027-11-15", "2027-12-08", "2027-12-25",
];

const DIAS_VACACIONES_ANIO = 15; // hábiles por año trabajado (Colombia)
const MS_DIA = 86_400_000;

const aISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** L–V y no festivo. */
export function esDiaHabil(d: Date, festivos: string[] = FESTIVOS_COLOMBIA): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !festivos.includes(aISO(d));
}

/**
 * Último día de vacaciones: consume `diasHabiles` días hábiles desde
 * `desde` (inclusive si es hábil). Ej: 5 días desde un lunes sin
 * festivos → viernes.
 */
export function ultimoDiaVacaciones(
  desde: string,
  diasHabiles: number,
  festivos: string[] = FESTIVOS_COLOMBIA,
): string {
  const d = parseISO(desde);
  let consumidos = 0;
  while (consumidos < diasHabiles) {
    if (esDiaHabil(d, festivos)) consumidos++;
    if (consumidos < diasHabiles) d.setDate(d.getDate() + 1);
  }
  return aISO(d);
}

/** Día de REGRESO al trabajo: siguiente día hábil tras el último día. */
export function fechaRegreso(
  desde: string,
  diasHabiles: number,
  festivos: string[] = FESTIVOS_COLOMBIA,
): string {
  const d = parseISO(ultimoDiaVacaciones(desde, diasHabiles, festivos));
  do {
    d.setDate(d.getDate() + 1);
  } while (!esDiaHabil(d, festivos));
  return aISO(d);
}

/** Días hábiles entre dos fechas (ambas inclusive). */
export function diasHabilesEntre(
  desde: string,
  hasta: string,
  festivos: string[] = FESTIVOS_COLOMBIA,
): number {
  const d = parseISO(desde);
  const fin = parseISO(hasta);
  let n = 0;
  while (d <= fin) {
    if (esDiaHabil(d, festivos)) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export interface SaldoVacaciones {
  devengados: number; // 15 × años servidos (proporcional, redondeado abajo)
  disfrutados: number;
  pendientes: number;
  /** Próximo aniversario de ingreso: "cumple derecho" a 15 días más. */
  proximoAniversario: string;
  aniosServicio: number; // años completos
}

export function saldoVacaciones(
  fecha_ingreso: string,
  diasDisfrutados: number,
  hoy: Date = new Date(),
): SaldoVacaciones {
  const ingreso = parseISO(fecha_ingreso);
  const dias = Math.max(0, Math.floor((hoy.getTime() - ingreso.getTime()) / MS_DIA));
  const devengados = Math.floor((dias / 365) * DIAS_VACACIONES_ANIO);
  const aniosServicio = Math.floor(dias / 365);

  const aniv = new Date(ingreso);
  aniv.setFullYear(ingreso.getFullYear() + aniosServicio + 1);
  return {
    devengados,
    disfrutados: diasDisfrutados,
    pendientes: devengados - diasDisfrutados,
    proximoAniversario: aISO(aniv),
    aniosServicio,
  };
}

/*
 * Tests inline (verificados a mano, festivos 2026):
 *  ultimoDiaVacaciones('2026-07-06', 5)  === '2026-07-10'  // lun→vie
 *  fechaRegreso('2026-07-06', 5)         === '2026-07-13'  // lunes
 *  fechaRegreso('2026-07-13', 6)         === '2026-07-22'  // salta 20 jul (festivo)
 *  diasHabilesEntre('2026-07-13','2026-07-21') === 6       // 20 jul festivo
 *  saldoVacaciones('2024-07-01', 20, new Date(2026, 6, 5)):
 *    ~2.01 años → devengados 30, pendientes 10, aniversario 2027-07-01
 */
