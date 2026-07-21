/**
 * NIVEL DE CUMPLIMIENTO — reglas de Juan (21-jul-2026).
 *
 * El problema del indicador viejo ("entregados a tiempo / entregados
 * en el mes"): solo miraba lo que ya salió, así que los atrasados sin
 * entregar eran invisibles y, al entregarlos, castigaban el mes
 * equivocado. Peor: el número mejoraba si NO entregabas lo atrasado.
 *
 * Aquí se mide por COMPROMISO, no por entrega:
 *   · Cohorte = OPs cuya fecha comprometida cayó en el mes (esté
 *     entregada o no) y que YA venció al corte.
 *   · Cumplida = entregada COMPLETA en o antes de esa fecha. La BD
 *     solo estampa fecha_entregada con el 100% despachado, así que
 *     "completa" viene garantizado.
 *   · La fecha es la ORIGINAL congelada: correr la fecha para no
 *     incumplir no maquilla el indicador.
 */

import type { OpCard } from "@/lib/data/ops";

export interface FilaIncumplida {
  op_id: string;
  numero: string;
  cliente: string;
  ciudad: string | null;
  comprometida: string; // 'YYYY-MM-DD' (original congelada)
  entregada: string | null;
  dias_atraso: number;
  valor: number;
  repactada: boolean;
  /** true = sigue abierta (deuda viva); false = se entregó tarde. */
  abierta: boolean;
}

export interface MesCumplimiento {
  mes: string; // 'YYYY-MM'
  etiqueta: string; // 'jul 26'
  comprometidas: number;
  cumplidas: number;
  pct: number; // 0–1
  valor_comprometido: number;
  valor_cumplido: number;
  pct_valor: number; // 0–1
  repactadas: number;
}

export interface TramoAtraso {
  etiqueta: string;
  n: number;
  valor: number;
}

export interface ResumenCumplimiento {
  /** Serie mensual por compromiso (solo meses ya vencidos). */
  serie: MesCumplimiento[];
  /** Acumulado del periodo mostrado. */
  total: MesCumplimiento;
  /** Deuda viva: abiertas cuya fecha comprometida ya pasó. */
  atrasadas_hoy: FilaIncumplida[];
  tramos: TramoAtraso[];
  dias_atraso_promedio: number;
  /** Incumplidas del periodo (entregadas tarde + abiertas vencidas). */
  incumplidas: FilaIncumplida[];
}

const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MS_DIA = 86_400_000;

const dia = (iso: string) => new Date(`${iso}T00:00:00`);
const diasEntre = (a: string, b: string) =>
  Math.round((dia(a).getTime() - dia(b).getTime()) / MS_DIA);

/** Tarjeta con lo que el cálculo necesita (evita acoplar a OpCard). */
export interface OpParaCumplimiento {
  op_id: string;
  numero: string;
  cliente: string;
  ciudad: string | null;
  comprometida: string | null; // fecha ORIGINAL congelada
  pactada: string | null; // vigente (para detectar re-pacto)
  entregada: string | null;
  valor: number;
  anulada: boolean;
}

export function opsParaCumplimiento(cards: OpCard[]): OpParaCumplimiento[] {
  return cards
    .filter((c) => c.tipo === "op" && !c.anulada)
    .map((c) => ({
      op_id: c.op_id,
      numero: c.numero,
      cliente: c.cliente.nombre,
      ciudad: c.ciudad?.nombre ?? null,
      comprometida: c.fecha_entrega_original ?? c.fecha_entrega_pactada,
      pactada: c.fecha_entrega_pactada,
      entregada: c.fecha_entregada,
      valor: c.items.reduce((a, i) => a + i.cantidad * i.precio_unit, 0),
      anulada: !!c.anulada,
    }));
}

export function calcularCumplimiento(
  ops: OpParaCumplimiento[],
  meses = 12,
  hoyDate: Date = new Date(),
): ResumenCumplimiento {
  const hoy = hoyDate.toISOString().slice(0, 10);

  // Meses a mostrar (el actual incluido: cuenta lo ya vencido de él)
  const claves: { mes: string; etiqueta: string }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoyDate.getFullYear(), hoyDate.getMonth() - i, 1);
    claves.push({
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    });
  }
  const indice = new Map(claves.map((k, i) => [k.mes, i]));
  const serie: MesCumplimiento[] = claves.map((k) => ({
    ...k,
    comprometidas: 0,
    cumplidas: 0,
    pct: 0,
    valor_comprometido: 0,
    valor_cumplido: 0,
    pct_valor: 0,
    repactadas: 0,
  }));

  const incumplidas: FilaIncumplida[] = [];
  const atrasadas_hoy: FilaIncumplida[] = [];

  for (const op of ops) {
    if (!op.comprometida) continue; // sin compromiso no hay qué medir
    const vencido = op.comprometida <= hoy;
    const cumplida = !!op.entregada && op.entregada <= op.comprometida;

    // ---- Serie por cohorte: solo compromisos YA vencidos ----
    const i = indice.get(op.comprometida.slice(0, 7));
    if (i !== undefined && vencido) {
      const m = serie[i];
      m.comprometidas += 1;
      m.valor_comprometido += op.valor;
      if (cumplida) {
        m.cumplidas += 1;
        m.valor_cumplido += op.valor;
      }
      if (op.pactada && op.pactada !== op.comprometida) m.repactadas += 1;
    }

    // ---- Incumplidas y deuda viva ----
    if (vencido && !cumplida) {
      const fila: FilaIncumplida = {
        op_id: op.op_id,
        numero: op.numero,
        cliente: op.cliente,
        ciudad: op.ciudad,
        comprometida: op.comprometida,
        entregada: op.entregada,
        dias_atraso: diasEntre(op.entregada ?? hoy, op.comprometida),
        valor: op.valor,
        repactada: !!op.pactada && op.pactada !== op.comprometida,
        abierta: !op.entregada,
      };
      if (i !== undefined) incumplidas.push(fila);
      if (!op.entregada) atrasadas_hoy.push(fila);
    }
  }

  for (const m of serie) {
    m.pct = m.comprometidas ? m.cumplidas / m.comprometidas : 0;
    m.pct_valor = m.valor_comprometido
      ? m.valor_cumplido / m.valor_comprometido
      : 0;
  }

  const total = serie.reduce<MesCumplimiento>(
    (a, m) => ({
      ...a,
      comprometidas: a.comprometidas + m.comprometidas,
      cumplidas: a.cumplidas + m.cumplidas,
      valor_comprometido: a.valor_comprometido + m.valor_comprometido,
      valor_cumplido: a.valor_cumplido + m.valor_cumplido,
      repactadas: a.repactadas + m.repactadas,
    }),
    {
      mes: "total",
      etiqueta: `${meses} meses`,
      comprometidas: 0,
      cumplidas: 0,
      pct: 0,
      valor_comprometido: 0,
      valor_cumplido: 0,
      pct_valor: 0,
      repactadas: 0,
    },
  );
  total.pct = total.comprometidas ? total.cumplidas / total.comprometidas : 0;
  total.pct_valor = total.valor_comprometido
    ? total.valor_cumplido / total.valor_comprometido
    : 0;

  // Antigüedad de la deuda viva
  const rangos: [string, number, number][] = [
    ["1 a 7 días", 1, 7],
    ["8 a 15 días", 8, 15],
    ["16 a 30 días", 16, 30],
    ["Más de 30 días", 31, Number.MAX_SAFE_INTEGER],
  ];
  const tramos: TramoAtraso[] = rangos.map(([etiqueta, min, max]) => {
    const filas = atrasadas_hoy.filter(
      (f) => f.dias_atraso >= min && f.dias_atraso <= max,
    );
    return {
      etiqueta,
      n: filas.length,
      valor: filas.reduce((a, f) => a + f.valor, 0),
    };
  });

  const dias_atraso_promedio = incumplidas.length
    ? Math.round(
        incumplidas.reduce((a, f) => a + f.dias_atraso, 0) / incumplidas.length,
      )
    : 0;

  atrasadas_hoy.sort((a, b) => b.dias_atraso - a.dias_atraso);
  incumplidas.sort((a, b) => b.comprometida.localeCompare(a.comprometida));

  return {
    serie,
    total,
    atrasadas_hoy,
    tramos,
    dias_atraso_promedio,
    incumplidas,
  };
}
