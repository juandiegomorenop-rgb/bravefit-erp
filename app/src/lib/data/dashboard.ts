/**
 * Data layer del Dashboard — CONSOLIDA los demás módulos por temas y
 * agrega los indicadores de CAPACIDAD DE PLANTA que pidió Juan.
 *
 * Indicador estrella: metros lineales de TUBERÍA CUADRADA 70×70 mm
 * (materia prima crítica que pasa por perforación) PROCESADOS al mes.
 * Se deriva del BOM: al ENTREGAR X racks/productos que usan esa tubería,
 * sabemos cuántos metros procesamos. Se contrasta con los metros VENDIDOS
 * (demanda) → el techo de lo procesado es la capacidad real de la planta.
 *
 * Otros cuellos de botella (poleas, bancos…) que no pasan por perforación
 * pero también copan capacidad, medidos en unidades/mes.
 */

import {
  getMercadeoRepository,
  type RangoFechas,
} from "@/lib/data/mercadeo";
import { getOpsRepository } from "@/lib/data/ops";
import { getRrhhRepository } from "@/lib/data/rrhh";

// ---------------------------------------------------------------
// BOM: metros de tubería 70×70 mm por producto (extracto medible)
// ---------------------------------------------------------------
// Rack PF5: 4 columnas × 2.30 m = 9.2 m (ver producto_componentes p-01).
// El resto se estima de la misma estructura de columnas/marcos.
export const TUBERIA_70_M_POR_PRODUCTO: Record<string, number> = {
  "p-01": 9.2, // Rack PF5 (4 columnas × 2.30)
  "p-02": 11.0, // Rack PF5 Pro (columnas más altas + refuerzos)
  "p-03": 24.0, // Rig Cross 4 estaciones
  "p-04": 5.2, // Rack de pared PF3 (2 columnas + base)
  "p-09": 14.1, // Jaula de potencia PF7 (6 columnas)
};

const PRODUCTOS_TUBERIA = Object.keys(TUBERIA_70_M_POR_PRODUCTO);

export interface PuntoCapacidad {
  mes: string; // 'YYYY-MM'
  etiqueta: string; // 'jul 26'
  procesada_m: number; // metros procesados (entregas × BOM)
  vendida_m: number; // metros vendidos (pedidos del mes × BOM)
  utilizacion: number; // procesada / techo
}

export interface CapacidadTuberia {
  serie: PuntoCapacidad[];
  techo_m: number; // máximo mensual procesado = capacidad demostrada
  mes_techo: string; // etiqueta del mes récord
  promedio_m: number;
  /** Meses en que la demanda superó lo procesado (se acumuló backlog). */
  meses_sobre_capacidad: number;
}

export interface CuelloBotella {
  nombre: string;
  unidad: string; // 'unidades', 'metros'…
  serie: { mes: string; etiqueta: string; cantidad: number }[];
  total: number;
  promedio: number;
  /** Variación del último mes vs promedio (%). */
  tendencia: number;
}

// ---------------------------------------------------------------
// KPIs por tema
// ---------------------------------------------------------------

export interface KpisDashboard {
  ventas: {
    total_periodo: number;
    pedidos: number;
    ticket_promedio: number;
    por_canal: { nombre: string; valor: number }[];
    por_ciudad: { nombre: string; valor: number }[];
    top_productos: { nombre: string; unidades: number; valor: number }[];
    por_vendedor: { nombre: string; valor: number }[];
    pipeline_valor: number; // cotizaciones abiertas
  };
  produccion: {
    ops_activas: number;
    en_cola: number;
    por_etapa: { etapa: string; n: number }[];
    vencidas: number;
    proximas_vencer: number; // rojo (≤2 sem)
  };
  logistica: {
    entregas_mes: number;
    entregas_anio: number;
    record_mes: number;
    record_etiqueta: string;
    garantias_abiertas: number;
  };
  rrhh: {
    empleados: number;
    tecnicos: number;
    de_vacaciones: number;
    vacaciones_pendientes: number;
  };
  mercadeo: {
    leads: number;
    tasa_cierre: number;
    roas_meta: number | null;
    valor_ganado: number;
  };
}

export interface DashboardRepository {
  capacidadTuberia(meses?: number): Promise<CapacidadTuberia>;
  cuellosBotella(meses?: number): Promise<CuelloBotella[]>;
  kpis(rango: RangoFechas): Promise<KpisDashboard>;
}

// ===============================================================
// MOCK
// ===============================================================

const MS_DIA = 86_400_000;
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function etiquetaMes(anio: number, mes0: number): string {
  return `${MESES_ES[mes0]} ${String(anio).slice(2)}`;
}

/** Genera los últimos `meses` como {anio, mes0, clave 'YYYY-MM'}. */
function ultimosMeses(meses: number): { anio: number; mes0: number; clave: string; etiqueta: string }[] {
  const hoy = new Date();
  const out: { anio: number; mes0: number; clave: string; etiqueta: string }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push({
      anio: d.getFullYear(),
      mes0: d.getMonth(),
      clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: etiquetaMes(d.getFullYear(), d.getMonth()),
    });
  }
  return out;
}

/**
 * Serie mensual determinista de UNIDADES de productos con tubería 70×70,
 * separada en entregadas (procesadas) y vendidas (demanda). El techo de
 * lo procesado ≈ 700-780 m/mes; algunos meses la demanda lo supera.
 */
function serieUnidadesTuberia(meses: number) {
  const rnd = mulberry(70700070);
  return ultimosMeses(meses).map((m, i) => {
    // capacidad crece levemente en el tiempo (mejoras de planta)
    const capBase = 700 + i * 6;
    // ocupación 0.82–1.0 de la capacidad (lo que la planta logró procesar)
    const ocup = 0.82 + rnd() * 0.18;
    const procesada_m = Math.round(capBase * ocup);
    // demanda: a veces por debajo, a veces por encima (picos de venta)
    const factorDemanda = 0.8 + rnd() * 0.5; // 0.8–1.3
    const vendida_m = Math.round(procesada_m * factorDemanda);
    return { ...m, procesada_m, vendida_m };
  });
}

/** Serie mensual de un cuello de botella (unidades), determinista. */
function serieCuello(nombreSeed: number, base: number, meses: number) {
  const rnd = mulberry(nombreSeed);
  return ultimosMeses(meses).map((m) => ({
    mes: m.clave,
    etiqueta: m.etiqueta,
    cantidad: Math.round(base * (0.7 + rnd() * 0.7)),
  }));
}

export class MockDashboardRepository implements DashboardRepository {
  async capacidadTuberia(meses = 12): Promise<CapacidadTuberia> {
    const filas = serieUnidadesTuberia(meses);
    const techo_m = Math.max(...filas.map((f) => f.procesada_m));
    const mesTecho = filas.find((f) => f.procesada_m === techo_m)!;
    const serie: PuntoCapacidad[] = filas.map((f) => ({
      mes: f.clave,
      etiqueta: f.etiqueta,
      procesada_m: f.procesada_m,
      vendida_m: f.vendida_m,
      utilizacion: f.procesada_m / techo_m,
    }));
    return {
      serie,
      techo_m,
      mes_techo: mesTecho.etiqueta,
      promedio_m: Math.round(filas.reduce((a, f) => a + f.procesada_m, 0) / filas.length),
      meses_sobre_capacidad: filas.filter((f) => f.vendida_m > f.procesada_m).length,
    };
  }

  async cuellosBotella(meses = 12): Promise<CuelloBotella[]> {
    const defs = [
      { nombre: "Poleas (sistemas) vendidas", unidad: "unidades", seed: 3001, base: 22 },
      { nombre: "Bancos fabricados", unidad: "unidades", seed: 3002, base: 30 },
      { nombre: "Tapizados (cojinería) procesados", unidad: "unidades", seed: 3003, base: 34 },
    ];
    return defs.map((d) => {
      const serie = serieCuello(d.seed, d.base, meses);
      const total = serie.reduce((a, s) => a + s.cantidad, 0);
      const promedio = Math.round(total / serie.length);
      const ultimo = serie[serie.length - 1].cantidad;
      return {
        nombre: d.nombre,
        unidad: d.unidad,
        serie,
        total,
        promedio,
        tendencia: promedio > 0 ? ((ultimo - promedio) / promedio) * 100 : 0,
      };
    });
  }

  async kpis(rango: RangoFechas): Promise<KpisDashboard> {
    const ops = getOpsRepository();
    const rrhh = getRrhhRepository();
    const mkt = getMercadeoRepository();

    const [cards, etapas, garantias, empleados, vacaciones, embudo, cacRoas] =
      await Promise.all([
        ops.listarOps(),
        ops.listarEtapas(),
        ops.listarGarantias({ estado: "abiertas" }),
        rrhh.listarEmpleados(),
        rrhh.listarVacaciones({ estado: "solicitada" }),
        mkt.embudoLeads(rango),
        mkt.cacRoas(rango),
      ]);

    const opsReales = cards.filter((c) => c.tipo === "op");
    const enRango = (iso: string | null) =>
      iso ? iso.slice(0, 10) >= rango.desde && iso.slice(0, 10) <= rango.hasta : false;

    // --- Ventas (desde OPs del rango + sus ítems) ---
    const opsDelRango = opsReales.filter((c) => enRango(c.fecha_creacion));
    const valorOp = (c: (typeof opsReales)[number]) =>
      c.items.reduce((a, i) => a + i.cantidad * i.precio_unit, 0);
    const total_periodo = opsDelRango.reduce((a, c) => a + valorOp(c), 0);

    const acumular = (
      pairs: [string, number][],
    ): { nombre: string; valor: number }[] => {
      const m = new Map<string, number>();
      for (const [k, v] of pairs) m.set(k, (m.get(k) ?? 0) + v);
      return [...m.entries()]
        .map(([nombre, valor]) => ({ nombre, valor }))
        .sort((a, b) => b.valor - a.valor);
    };

    const por_canal = acumular(opsDelRango.map((c) => [c.origen.nombre, valorOp(c)]));
    const por_ciudad = acumular(
      opsDelRango.map((c) => [c.ciudad?.nombre ?? "Sin ciudad", valorOp(c)]),
    ).slice(0, 6);

    const prodMap = new Map<string, { unidades: number; valor: number }>();
    for (const c of opsDelRango) {
      for (const it of c.items) {
        const cur = prodMap.get(it.producto.nombre) ?? { unidades: 0, valor: 0 };
        cur.unidades += it.cantidad;
        cur.valor += it.cantidad * it.precio_unit;
        prodMap.set(it.producto.nombre, cur);
      }
    }
    const top_productos = [...prodMap.entries()]
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);

    // por vendedor: derivado de las cotizaciones vinculadas no está en OpCard;
    // aproximamos con el origen 'cotizacion' y repartimos — simplificado:
    const por_vendedor = acumular(
      opsDelRango
        .filter((c) => c.origen.clave === "cotizacion")
        .map((c) => ["Equipo comercial", valorOp(c)]),
    );

    // --- Producción ---
    const activas = opsReales.filter(
      (c) => !c.fecha_entregada,
    );
    const etapaNombre = (id: number) => etapas.find((e) => e.id === id)?.nombre ?? "—";
    const por_etapa = etapas
      .map((e) => ({
        etapa: e.nombre,
        n: activas.filter((c) => c.etapa_id === e.id).length,
      }))
      .filter((x) => x.n > 0);
    const hoy = new Date().toISOString().slice(0, 10);
    const dias = (f: string) =>
      Math.round((new Date(f).getTime() - new Date(hoy).getTime()) / MS_DIA);
    const vencidas = activas.filter(
      (c) => c.fecha_entrega_pactada && c.fecha_entrega_pactada < hoy,
    ).length;
    const proximas_vencer = activas.filter((c) => {
      if (!c.fecha_entrega_pactada || c.fecha_entrega_pactada < hoy) return false;
      return dias(c.fecha_entrega_pactada) <= 14;
    }).length;

    // --- Logística (entregas) ---
    const entregadas = opsReales.filter((c) => c.fecha_entregada);
    const anioActual = hoy.slice(0, 4);
    const mesActual = hoy.slice(0, 7);
    const entregas_mes = entregadas.filter((c) =>
      c.fecha_entregada!.startsWith(mesActual),
    ).length;
    const entregas_anio = entregadas.filter((c) =>
      c.fecha_entregada!.startsWith(anioActual),
    ).length;

    return {
      ventas: {
        total_periodo,
        pedidos: opsDelRango.length,
        ticket_promedio: opsDelRango.length
          ? Math.round(total_periodo / opsDelRango.length)
          : 0,
        por_canal,
        por_ciudad,
        top_productos,
        por_vendedor,
        pipeline_valor: 0, // se completa abajo si hace falta
      },
      produccion: {
        ops_activas: activas.length,
        en_cola: activas.filter((c) => etapaNombre(c.etapa_id) === "En Cola").length,
        por_etapa,
        vencidas,
        proximas_vencer,
      },
      logistica: {
        entregas_mes,
        entregas_anio,
        record_mes: 12, // récord histórico (ver módulo Entregas)
        record_etiqueta: "dic 2025",
        garantias_abiertas: garantias.length,
      },
      rrhh: {
        empleados: empleados.length,
        tecnicos: empleados.filter((e) => e.empleado.es_tecnico).length,
        de_vacaciones: empleados.filter((e) => e.regresaEl).length,
        vacaciones_pendientes: vacaciones.length,
      },
      mercadeo: {
        leads: embudo.total,
        tasa_cierre: embudo.tasa_cierre,
        roas_meta: cacRoas.find((c) => c.canal === "Meta Ads")?.roas ?? null,
        valor_ganado: embudo.valor_ganado,
      },
    };
  }
}

const g = globalThis as unknown as { __dashboardRepositorio?: DashboardRepository };

export function getDashboardRepository(): DashboardRepository {
  g.__dashboardRepositorio ??= new MockDashboardRepository();
  return g.__dashboardRepositorio;
}
