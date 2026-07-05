/**
 * Data layer de Mercadeo — INTERCAMBIABLE. Espejo del modelo genérico de
 * la spec: canales (plataforma = campo, no tabla), contenido orgánico +
 * métricas diarias (serie de tiempo), pauta (campaña→conjunto→anuncio) +
 * métricas diarias, y LEADS como puente a cotizaciones (CAC/ROAS reales).
 *
 * Los agregados (engagement_score, CAC, ROAS) se calculan sobre el rango
 * de fechas elegido — NUNCA se almacenan (sección 5 de la spec).
 */

import { fechaRel } from "@/lib/data/ops";
import { formatCOP } from "@/lib/formato";

// ---------------------------------------------------------------
// Tipos (espejo del esquema; enriquecidos para la UI)
// ---------------------------------------------------------------

export type TipoFormato = "reel" | "carrusel" | "estatico" | "story" | "video";
export type Segmento = "B2B" | "B2C" | "ambos";
export type EstadoLead = "nuevo" | "cotizado" | "cerrado_ganado" | "cerrado_perdido";

export interface Canal {
  id: number;
  nombre: string;
  tipo: "organico" | "pauta" | "mensajeria";
  estado: "activo" | "planeado" | "inactivo";
}

export interface RangoFechas {
  desde: string; // YYYY-MM-DD
  hasta: string;
}

export interface FiltrosContenido extends RangoFechas {
  formato?: TipoFormato;
  categoria?: string;
  segmento?: Segmento;
}

/** Contenido con métricas AGREGADAS sobre el rango + engagement_score. */
export interface ContenidoAgregado {
  id: string;
  canal: string;
  tipo_formato: TipoFormato;
  categoria_producto: string | null;
  segmento: Segmento | null;
  titulo: string;
  url_publica: string | null;
  alcance: number;
  alcance_no_seguidores: number;
  likes: number;
  comentarios: number;
  compartidos: number;
  guardados: number;
  clics_whatsapp: number;
  tasa_interaccion: number; // (likes+com+shares+saves)/alcance
  engagement_score: number; // fórmula ponderada (sección 5)
}

export interface PautaCanal {
  canal: string;
  gasto: number;
  impresiones: number;
  clics: number;
  resultados: number;
  costo_por_resultado: number; // gasto / resultados
  ctr: number; // clics / impresiones
}

export interface EmbudoLeads {
  nuevo: number;
  cotizado: number;
  cerrado_ganado: number;
  cerrado_perdido: number;
  total: number;
  tasa_cierre: number; // ganado / total
  valor_ganado: number;
}

export interface CacRoasCanal {
  canal: string;
  gasto: number;
  leads: number;
  cerrados: number;
  ingresos: number; // Σ valor_cierre de cerrado_ganado
  cac: number | null; // gasto / cerrados
  roas: number | null; // ingresos / gasto
}

export interface PruebaCreativa {
  id: string;
  hipotesis: string;
  variantes: string[];
  resultado: string | null;
  se_aplico: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

export interface MercadeoRepository {
  listarCanales(): Promise<Canal[]>;
  categorias(): Promise<string[]>;
  topContenido(filtros: FiltrosContenido, limite?: number): Promise<ContenidoAgregado[]>;
  rendimientoContenido(filtros: FiltrosContenido): Promise<ContenidoAgregado[]>;
  pautaPorCanal(rango: RangoFechas): Promise<PautaCanal[]>;
  embudoLeads(rango: RangoFechas): Promise<EmbudoLeads>;
  cacRoas(rango: RangoFechas): Promise<CacRoasCanal[]>;
  listarPruebas(): Promise<PruebaCreativa[]>;
}

// ===============================================================
// MOCK — Instagram orgánico + Meta Ads (Fase 1)
// ===============================================================

const CANALES: Canal[] = [
  { id: 1, nombre: "Instagram", tipo: "organico", estado: "activo" },
  { id: 2, nombre: "Meta Ads", tipo: "pauta", estado: "activo" },
  { id: 3, nombre: "Google Ads", tipo: "pauta", estado: "planeado" },
  { id: 4, nombre: "TikTok Ads", tipo: "pauta", estado: "planeado" },
  { id: 5, nombre: "WhatsApp", tipo: "mensajeria", estado: "planeado" },
];

const CATEGORIAS_MKT = ["Racks", "Rigs", "Fuerza", "Acondicionamiento", "Hogar", "Accesorios"];

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ContenidoSeed {
  id: string;
  formato: TipoFormato;
  categoria: string;
  segmento: Segmento;
  titulo: string;
  publicadoHace: number; // días
  /** "fuerza" base del post (1 = normal, >1 viral): escala las métricas. */
  fuerza: number;
}

const CONTENIDOS: ContenidoSeed[] = [
  { id: "co-01", formato: "reel", categoria: "Racks", segmento: "B2C", titulo: "Arma tu rack PF5 en casa (timelapse)", publicadoHace: 6, fuerza: 3.2 },
  { id: "co-02", formato: "carrusel", categoria: "Fuerza", segmento: "ambos", titulo: "5 errores al comprar un banco", publicadoHace: 10, fuerza: 2.1 },
  { id: "co-03", formato: "reel", categoria: "Rigs", segmento: "B2B", titulo: "Montaje de rig en box de CrossFit", publicadoHace: 14, fuerza: 2.6 },
  { id: "co-04", formato: "estatico", categoria: "Hogar", segmento: "B2C", titulo: "Gimnasio en 6 m² — antes/después", publicadoHace: 3, fuerza: 1.8 },
  { id: "co-05", formato: "video", categoria: "Acondicionamiento", segmento: "B2C", titulo: "Prueba de resistencia de la trotadora", publicadoHace: 20, fuerza: 1.4 },
  { id: "co-06", formato: "carrusel", categoria: "Racks", segmento: "B2B", titulo: "Dotación llave en mano para gimnasios", publicadoHace: 25, fuerza: 1.6 },
  { id: "co-07", formato: "story", categoria: "Accesorios", segmento: "B2C", titulo: "Nuevos agarres de polea", publicadoHace: 2, fuerza: 0.9 },
  { id: "co-08", formato: "reel", categoria: "Fuerza", segmento: "B2C", titulo: "Cliente entrenando con su banco Bravefit", publicadoHace: 30, fuerza: 4.1 },
  { id: "co-09", formato: "estatico", categoria: "Racks", segmento: "ambos", titulo: "Ficha técnica del PF7", publicadoHace: 45, fuerza: 1.1 },
  { id: "co-10", formato: "carrusel", categoria: "Hogar", segmento: "B2C", titulo: "Cómo elegir tu primer set de mancuernas", publicadoHace: 60, fuerza: 1.5 },
];

interface CampanaSeed {
  id: string;
  canal_id: number;
  nombre: string;
  objetivo: string;
  segmento: Segmento;
  categoria: string;
  gastoDia: number; // base diaria
  resultadosDia: number; // base diaria (mensajes/leads)
}

const CAMPANAS: CampanaSeed[] = [
  { id: "ca-01", canal_id: 2, nombre: "b2c-racks-jul26", objetivo: "mensajes", segmento: "B2C", categoria: "Racks", gastoDia: 45_000, resultadosDia: 6 },
  { id: "ca-02", canal_id: 2, nombre: "b2b-rigs-jul26", objetivo: "leads", segmento: "B2B", categoria: "Rigs", gastoDia: 60_000, resultadosDia: 3 },
  { id: "ca-03", canal_id: 2, nombre: "b2c-hogar-jun26", objetivo: "trafico", segmento: "B2C", categoria: "Hogar", gastoDia: 30_000, resultadosDia: 8 },
];

const PRUEBAS: PruebaCreativa[] = [
  {
    id: "pr-01",
    hipotesis: "El ángulo 'precio' convierte mejor que 'durabilidad' en B2C.",
    variantes: ["ca-01 · anuncio precio", "ca-01 · anuncio durabilidad"],
    resultado: "El ángulo precio bajó el costo por mensaje 22%. Se deja como creativo principal en B2C.",
    se_aplico: true,
    fecha_inicio: fechaRel(-40),
    fecha_fin: fechaRel(-26),
  },
  {
    id: "pr-02",
    hipotesis: "Reels de montaje generan más guardados que carruseles de ficha técnica.",
    variantes: ["co-01 reel montaje", "co-09 estático ficha"],
    resultado: "El reel de montaje 4× guardados. Priorizar formato reel para racks.",
    se_aplico: true,
    fecha_inicio: fechaRel(-20),
    fecha_fin: fechaRel(-6),
  },
  {
    id: "pr-03",
    hipotesis: "Publicar a las 7pm mejora el alcance de no-seguidores.",
    variantes: ["horario 7pm", "horario 1pm"],
    resultado: null,
    se_aplico: false,
    fecha_inicio: fechaRel(-3),
    fecha_fin: null,
  },
];

// Leads: se generan deterministas, algunos enlazados a cotizaciones reales
const COTIZ_LINK = ["q-01", "q-02", "q-04", "q-07", "q-10", null, null, null];

const MS_DIA = 86_400_000;
const hoy0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const enRango = (fecha: string, r: RangoFechas) => fecha >= r.desde && fecha <= r.hasta;

interface MetricaContenidoDia {
  contenido_id: string;
  fecha: string;
  alcance: number;
  alcance_no_seguidores: number;
  impresiones: number;
  likes: number;
  comentarios: number;
  compartidos: number;
  guardados: number;
  clics_whatsapp: number;
}

interface MetricaPautaDia {
  campana_id: string;
  fecha: string;
  impresiones: number;
  clics: number;
  gasto: number;
  resultados: number;
}

interface LeadRow {
  id: string;
  fecha: string;
  canal_id: number;
  campana_id: string | null;
  segmento: "B2B" | "B2C";
  estado: EstadoLead;
  valor_cierre: number | null;
}

interface MercadeoStore {
  metContenido: MetricaContenidoDia[];
  metPauta: MetricaPautaDia[];
  leads: LeadRow[];
}

const g = globalThis as unknown as {
  __mercadeoStore?: MercadeoStore;
  __mercadeoRepositorio?: MercadeoRepository;
};

function construir(): MercadeoStore {
  const rnd = mulberry(20260705);
  const metContenido: MetricaContenidoDia[] = [];
  // 90 días de métricas por contenido, con decaimiento desde su publicación
  for (const c of CONTENIDOS) {
    for (let d = 0; d < 90; d++) {
      const fecha = new Date(hoy0().getTime() - d * MS_DIA);
      const edad = d - 0; // días atrás
      // solo desde su publicación hacia atrás no; el post existe desde publicadoHace
      if (edad > c.publicadoHace) continue;
      // decaimiento: más actividad los primeros días tras publicar
      const antiguedadPost = c.publicadoHace - edad; // 0 = día de publicación
      const decay = Math.exp(-antiguedadPost / 4);
      const base = c.fuerza * decay;
      if (base < 0.02) continue;
      const alcance = Math.round((300 + rnd() * 500) * base * 10);
      const noSeg = Math.round(alcance * (0.4 + rnd() * 0.3));
      metContenido.push({
        contenido_id: c.id,
        fecha: iso(fecha),
        alcance,
        alcance_no_seguidores: noSeg,
        impresiones: Math.round(alcance * (1.3 + rnd() * 0.5)),
        likes: Math.round(alcance * (0.04 + rnd() * 0.05)),
        comentarios: Math.round(alcance * (0.004 + rnd() * 0.006)),
        compartidos: Math.round(alcance * (0.006 + rnd() * 0.008)),
        guardados: Math.round(alcance * (0.008 + rnd() * 0.012)),
        clics_whatsapp: Math.round(alcance * (0.002 + rnd() * 0.004)),
      });
    }
  }

  const metPauta: MetricaPautaDia[] = [];
  for (const ca of CAMPANAS) {
    // campañas jul activas ~30 días, jun ~45 días atrás
    const dias = ca.nombre.includes("jun") ? 45 : 30;
    const offset = ca.nombre.includes("jun") ? 20 : 0;
    for (let d = offset; d < offset + dias; d++) {
      const fecha = new Date(hoy0().getTime() - d * MS_DIA);
      const wobble = 0.7 + rnd() * 0.6;
      const gasto = Math.round(ca.gastoDia * wobble);
      const impresiones = Math.round(gasto / (12 + rnd() * 8));
      metPauta.push({
        campana_id: ca.id,
        fecha: iso(fecha),
        impresiones,
        clics: Math.round(impresiones * (0.01 + rnd() * 0.015)),
        gasto,
        resultados: Math.max(0, Math.round(ca.resultadosDia * wobble)),
      });
    }
  }

  // Leads: ~1-2 por día repartidos por canal; algunos cierran
  const leads: LeadRow[] = [];
  let ln = 1;
  for (let d = 0; d < 75; d++) {
    const fecha = new Date(hoy0().getTime() - d * MS_DIA);
    const cuantos = rnd() < 0.6 ? 1 : rnd() < 0.3 ? 2 : 0;
    for (let k = 0; k < cuantos; k++) {
      const dePauta = rnd() < 0.65;
      const ca = CAMPANAS[Math.floor(rnd() * CAMPANAS.length)];
      const canal_id = dePauta ? 2 : 1;
      const segmento: "B2B" | "B2C" = (dePauta ? ca.segmento : rnd() < 0.5 ? "B2B" : "B2C") === "B2B" ? "B2B" : "B2C";
      // estado: la mayoría nuevo/cotizado, algunos ganan/pierden
      const rr = rnd();
      const estado: EstadoLead =
        rr < 0.18 ? "cerrado_ganado" : rr < 0.32 ? "cerrado_perdido" : rr < 0.6 ? "cotizado" : "nuevo";
      const valor_cierre =
        estado === "cerrado_ganado" ? Math.round((1_200_000 + rnd() * 18_000_000) / 1000) * 1000 : null;
      leads.push({
        id: `le-${ln++}`,
        fecha: iso(fecha),
        canal_id,
        campana_id: dePauta ? ca.id : null,
        segmento,
        estado,
        valor_cierre,
      });
    }
  }

  return { metContenido, metPauta, leads };
}

function getStore(): MercadeoStore {
  g.__mercadeoStore ??= construir();
  return g.__mercadeoStore;
}

function nombreCanal(id: number) {
  return CANALES.find((c) => c.id === id)?.nombre ?? "—";
}

export class MockMercadeoRepository implements MercadeoRepository {
  private get store() {
    return getStore();
  }

  async listarCanales(): Promise<Canal[]> {
    return [...CANALES];
  }

  async categorias(): Promise<string[]> {
    return [...CATEGORIAS_MKT];
  }

  private agregarContenido(filtros: FiltrosContenido): ContenidoAgregado[] {
    return CONTENIDOS.filter((c) => !filtros.formato || c.formato === filtros.formato)
      .filter((c) => !filtros.categoria || c.categoria === filtros.categoria)
      .filter(
        (c) =>
          !filtros.segmento ||
          c.segmento === filtros.segmento ||
          c.segmento === "ambos" ||
          filtros.segmento === "ambos",
      )
      .map((c) => {
        const filas = this.store.metContenido.filter(
          (m) => m.contenido_id === c.id && enRango(m.fecha, filtros),
        );
        const sum = (k: keyof MetricaContenidoDia) =>
          filas.reduce((a, m) => a + (m[k] as number), 0);
        const alcance = sum("alcance");
        const likes = sum("likes");
        const comentarios = sum("comentarios");
        const compartidos = sum("compartidos");
        const guardados = sum("guardados");
        const interacciones = likes + comentarios + compartidos + guardados;
        // fórmula ponderada de la spec (sección 5)
        const engagement =
          alcance > 0
            ? (likes + comentarios * 2 + compartidos * 3 + guardados * 3) / alcance
            : 0;
        return {
          id: c.id,
          canal: "Instagram",
          tipo_formato: c.formato,
          categoria_producto: c.categoria,
          segmento: c.segmento,
          titulo: c.titulo,
          url_publica: null,
          alcance,
          alcance_no_seguidores: sum("alcance_no_seguidores"),
          likes,
          comentarios,
          compartidos,
          guardados,
          clics_whatsapp: sum("clics_whatsapp"),
          tasa_interaccion: alcance > 0 ? interacciones / alcance : 0,
          engagement_score: engagement,
        };
      })
      .filter((c) => c.alcance > 0);
  }

  async topContenido(filtros: FiltrosContenido, limite = 3): Promise<ContenidoAgregado[]> {
    return this.agregarContenido(filtros)
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, limite);
  }

  async rendimientoContenido(filtros: FiltrosContenido): Promise<ContenidoAgregado[]> {
    return this.agregarContenido(filtros).sort((a, b) => b.alcance - a.alcance);
  }

  async pautaPorCanal(rango: RangoFechas): Promise<PautaCanal[]> {
    const porCanal = new Map<number, PautaCanal>();
    for (const ca of CAMPANAS) {
      const filas = this.store.metPauta.filter(
        (m) => m.campana_id === ca.id && enRango(m.fecha, rango),
      );
      if (filas.length === 0) continue;
      const acc = porCanal.get(ca.canal_id) ?? {
        canal: nombreCanal(ca.canal_id),
        gasto: 0,
        impresiones: 0,
        clics: 0,
        resultados: 0,
        costo_por_resultado: 0,
        ctr: 0,
      };
      for (const m of filas) {
        acc.gasto += m.gasto;
        acc.impresiones += m.impresiones;
        acc.clics += m.clics;
        acc.resultados += m.resultados;
      }
      porCanal.set(ca.canal_id, acc);
    }
    return [...porCanal.values()].map((p) => ({
      ...p,
      costo_por_resultado: p.resultados > 0 ? Math.round(p.gasto / p.resultados) : 0,
      ctr: p.impresiones > 0 ? p.clics / p.impresiones : 0,
    }));
  }

  async embudoLeads(rango: RangoFechas): Promise<EmbudoLeads> {
    const filas = this.store.leads.filter((l) => enRango(l.fecha, rango));
    const n = (e: EstadoLead) => filas.filter((l) => l.estado === e).length;
    const total = filas.length;
    const ganado = n("cerrado_ganado");
    return {
      nuevo: n("nuevo"),
      cotizado: n("cotizado"),
      cerrado_ganado: ganado,
      cerrado_perdido: n("cerrado_perdido"),
      total,
      tasa_cierre: total > 0 ? ganado / total : 0,
      valor_ganado: filas
        .filter((l) => l.estado === "cerrado_ganado")
        .reduce((a, l) => a + (l.valor_cierre ?? 0), 0),
    };
  }

  async cacRoas(rango: RangoFechas): Promise<CacRoasCanal[]> {
    const leads = this.store.leads.filter((l) => enRango(l.fecha, rango));
    const gastoPorCanal = new Map<number, number>();
    for (const ca of CAMPANAS) {
      const gasto = this.store.metPauta
        .filter((m) => m.campana_id === ca.id && enRango(m.fecha, rango))
        .reduce((a, m) => a + m.gasto, 0);
      gastoPorCanal.set(ca.canal_id, (gastoPorCanal.get(ca.canal_id) ?? 0) + gasto);
    }
    const canales = new Set<number>([...gastoPorCanal.keys(), ...leads.map((l) => l.canal_id)]);
    return [...canales].map((canal_id) => {
      const delCanal = leads.filter((l) => l.canal_id === canal_id);
      const cerrados = delCanal.filter((l) => l.estado === "cerrado_ganado");
      const gasto = gastoPorCanal.get(canal_id) ?? 0;
      const ingresos = cerrados.reduce((a, l) => a + (l.valor_cierre ?? 0), 0);
      return {
        canal: nombreCanal(canal_id),
        gasto,
        leads: delCanal.length,
        cerrados: cerrados.length,
        ingresos,
        cac: cerrados.length > 0 && gasto > 0 ? Math.round(gasto / cerrados.length) : null,
        roas: gasto > 0 ? Math.round((ingresos / gasto) * 100) / 100 : null,
      };
    });
  }

  async listarPruebas(): Promise<PruebaCreativa[]> {
    return structuredClone(PRUEBAS);
  }
}

export function getMercadeoRepository(): MercadeoRepository {
  g.__mercadeoRepositorio ??= new MockMercadeoRepository();
  return g.__mercadeoRepositorio;
}

/** Helper de formato para porcentajes de engagement. */
export function fmtPct(v: number, dec = 1): string {
  return `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: dec })}%`;
}

export { formatCOP };
