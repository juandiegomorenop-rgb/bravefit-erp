/**
 * Capa de datos del CHAT DE CLAUDE embebido.
 *
 * El chat es el diferenciador de Bravefit: un asistente que responde
 * preguntas sobre el ERP consultando los MISMOS repos que la UI, y respeta
 * los permisos del usuario (solo puede consultar los módulos que puede ver).
 *
 * Arquitectura idéntica al resto del ERP: la ruta de API (`/api/chat`) y el
 * modo demo solo conocen esta capa. Hoy las herramientas leen los repos MOCK;
 * cuando exista Supabase, esas mismas funciones consultarán la BD con el JWT
 * del usuario y NADA más cambia.
 *
 * FASE 1 (implementada): consultas de solo lectura.
 * FASE 2 (documentada, pendiente): acciones (crear cotización, agregar
 *   observación a una OP) — se sumarían como herramientas con `escribe: true`
 *   y un guard de `puede_crear` en el dispatcher.
 */

// DATOS REALES: el chat consulta los MISMOS repos server que la UI
// (solo el route /api/chat importa este módulo — contexto server).
// RRHH sigue mock (módulo sin conectar; igual que su página).
import {
  getCotizacionesRepository,
  getCrmRepository,
} from "@/lib/data/crm-cotizaciones-server";
import { kpisDashboard } from "@/lib/data/dashboard-server";
import { getEntregasRepository } from "@/lib/data/entregas-server";
import { estadoBuffer } from "@/lib/data/inventario";
import { getInventarioRepository } from "@/lib/data/inventario-server";
import { bomDeProductos, getOpsRepository } from "@/lib/data/ops-server";
import { getRrhhRepository } from "@/lib/data/rrhh";
import type { RangoFechas } from "@/lib/data/mercadeo";
import type { Modulo } from "@/lib/permisos";

// ---------------------------------------------------------------
// Utilidades de rango de fechas (espejo de app/(erp)/page.tsx)
// ---------------------------------------------------------------

export type Periodo = "mes" | "trimestre" | "anio";

function rangoDe(periodo: Periodo): RangoFechas {
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (periodo === "trimestre") {
    return {
      desde: iso(new Date(hoy.getTime() - 89 * 86_400_000)),
      hasta: iso(hoy),
    };
  }
  if (periodo === "anio") {
    return { desde: iso(new Date(hoy.getFullYear(), 0, 1)), hasta: iso(hoy) };
  }
  return {
    desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: iso(hoy),
  };
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------
// Definición de herramientas
// ---------------------------------------------------------------

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

export interface HerramientaChat {
  name: string;
  /** Módulo que el usuario debe poder ver para usar la herramienta. */
  modulo: Modulo;
  description: string;
  input_schema: JsonSchema;
  ejecutar: (input: Record<string, unknown>) => Promise<unknown>;
  /** Palabras clave para el intent-match del modo demo (sin API key). */
  claves: string[];
}

const PERIODO_PROP = {
  periodo: {
    type: "string",
    enum: ["mes", "trimestre", "anio"],
    description: "Ventana de tiempo. 'mes' = mes en curso (por defecto).",
  },
};

export const HERRAMIENTAS: HerramientaChat[] = [
  {
    name: "resumen_general",
    modulo: "dashboard",
    description:
      "Indicadores consolidados del periodo por tema: ventas (total, pedidos, ticket, top productos, por canal/ciudad/vendedor, pipeline), producción (OPs activas, en cola, vencidas), logística (entregas del mes/año, garantías), RRHH y mercadeo (leads, ROAS, valor ganado). Úsala para preguntas amplias de '¿cómo vamos?', ventas del mes, o cualquier KPI de negocio.",
    input_schema: {
      type: "object",
      properties: { ...PERIODO_PROP },
      additionalProperties: false,
    },
    claves: [
      "resumen",
      "como vamos",
      "kpi",
      "ventas",
      "vendido",
      "vendimos",
      "indicador",
      "general",
      "negocio",
      "ticket",
      "pedidos",
    ],
    async ejecutar(input) {
      const periodo = (input.periodo as Periodo) ?? "mes";
      return {
        periodo,
        ...(await kpisDashboard(rangoDe(periodo))),
        nota_rrhh:
          "IMPORTANTE: los datos de RRHH son de EJEMPLO (módulo sin conectar) — adviértelo si el usuario pregunta por RRHH.",
      };
    },
  },
  {
    name: "capacidad_planta",
    modulo: "dashboard",
    description:
      "Capacidad de planta medida en metros lineales de tubería cuadrada 70×70 mm (la materia prima más usada): metros PROCESADOS (entregados) vs. VENDIDOS por mes, techo demostrado, promedio y meses sobre capacidad. Incluye cuellos de botella: poleas, bancos y tapizados vendidos por mes. Úsala para 'metros de tubería', 'capacidad', 'cuántas poleas vendemos'.",
    input_schema: {
      type: "object",
      properties: {
        meses: {
          type: "integer",
          description: "Meses a analizar (1–24). Por defecto 12.",
        },
      },
      additionalProperties: false,
    },
    claves: [
      "tuberia",
      "tubería",
      "capacidad",
      "planta",
      "metros",
      "polea",
      "poleas",
      "cuello",
      "banco",
      "tapizado",
      "70x70",
      "procesado",
    ],
    async ejecutar() {
      // Sin BOM de tubería cargado el indicador sería inventado — se
      // responde honesto (igual que el aviso del Dashboard).
      return {
        disponible: false,
        motivo:
          "El indicador de capacidad de planta se calcula con el BOM de tubería 70×70 por producto, que aún no está cargado en el catálogo. Cuando se cargue, este indicador se activa solo (Dashboard → Capacidad de planta).",
      };
    },
  },
  {
    name: "ordenes_produccion",
    modulo: "produccion",
    description:
      "Estado de las órdenes de pedido (OPs) en planta: activas, en cola, por etapa, vencidas y próximas a vencer. Incluye la lista de OPs vencidas (fecha de entrega pactada ya pasó y aún no se entregan). Úsala para 'OPs vencidas', 'qué hay en producción', 'órdenes atrasadas'.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    claves: [
      "op",
      "ops",
      "orden",
      "ordenes",
      "órdenes",
      "produccion",
      "producción",
      "vencida",
      "vencidas",
      "atrasada",
      "etapa",
      "planta cola",
    ],
    async ejecutar() {
      const ops = getOpsRepository();
      const [kpis, cards] = await Promise.all([
        kpisDashboard(rangoDe("mes")),
        ops.listarOps(),
      ]);
      const hoy = hoyISO();
      const vencidas = cards
        .filter(
          (c) =>
            c.tipo === "op" &&
            !c.fecha_entregada &&
            c.fecha_entrega_pactada !== null &&
            c.fecha_entrega_pactada < hoy,
        )
        .map((c) => ({
          numero: c.numero,
          cliente: c.cliente.nombre,
          ciudad: c.ciudad?.nombre ?? null,
          entrega_pactada: c.fecha_entrega_pactada,
        }));
      return {
        activas: kpis.produccion.ops_activas,
        en_cola: kpis.produccion.en_cola,
        vencidas: kpis.produccion.vencidas,
        proximas_a_vencer: kpis.produccion.proximas_vencer,
        por_etapa: kpis.produccion.por_etapa,
        lista_vencidas: vencidas.slice(0, 25),
      };
    },
  },
  {
    name: "materiales_para_ops",
    modulo: "produccion",
    description:
      "Cruza el BOM (despiece) de una o varias OPs contra el inventario de materia prima: cuánto requiere cada material, cuánto hay disponible y cuánto FALTA comprar. Acepta números de OP completos o parciales (ej. 'OP_WA_0007' o solo '0007'). Úsala para '¿qué material necesito para estas OPs?', '¿alcanza el inventario para…?', '¿qué falta comprar para fabricar…?'.",
    input_schema: {
      type: "object",
      properties: {
        ops: {
          type: "array",
          items: { type: "string" },
          description: "Números de OP, completos o parciales.",
        },
      },
      required: ["ops"],
      additionalProperties: false,
    },
    claves: [
      "material",
      "materiales",
      "necesito",
      "falta",
      "faltante",
      "alcanza",
      "bom",
      "despiece",
      "platina",
      "platinas",
      "comprar para",
    ],
    async ejecutar(input) {
      const pedidos = ((input.ops as string[] | undefined) ?? [])
        .map((s) => String(s).trim())
        .filter(Boolean);
      if (!pedidos.length) {
        return { error: "Indica al menos un número de OP (ej. OP_WA_0007)." };
      }
      const norm = (s: string) => s.toUpperCase().replace(/[\s\-–]/g, "_");
      const cards = (await getOpsRepository().listarOps()).filter(
        (c) => c.tipo === "op" && !c.anulada,
      );

      const porId = new Map<string, (typeof cards)[number]>();
      const noEncontradas: string[] = [];
      for (const q of pedidos) {
        const matches = cards.filter((c) => norm(c.numero).includes(norm(q)));
        if (!matches.length) noEncontradas.push(q);
        matches.forEach((c) => porId.set(c.op_id, c));
      }
      const ops = [...porId.values()];
      if (!ops.length) {
        return {
          error: "Ninguna OP coincidió con esos números.",
          ops_no_encontradas: noEncontradas,
        };
      }

      const bom = await bomDeProductos(
        ops.flatMap((c) => c.items.map((i) => i.producto_id)),
      );
      const requerido = new Map<string, number>();
      const sinBom = new Set<string>();
      for (const c of ops) {
        for (const it of c.items) {
          const comps = bom.get(it.producto_id) ?? [];
          if (!comps.length) {
            sinBom.add(it.producto.nombre);
            continue;
          }
          for (const comp of comps) {
            const clave = comp.material_nombre ?? comp.descripcion;
            requerido.set(
              clave,
              (requerido.get(clave) ?? 0) + comp.cantidad * it.cantidad,
            );
          }
        }
      }

      const mp = await getInventarioRepository().listarExistenciasMP();
      const disponible = new Map(
        mp.map((e) => [e.material.nombre, e.existencia.cantidad_disponible]),
      );
      const materiales = [...requerido.entries()]
        .map(([material, req]) => {
          const disp = disponible.get(material) ?? 0;
          return {
            material,
            requerido: req,
            disponible: disp,
            faltante: Math.max(0, req - disp),
          };
        })
        .sort((a, b) => b.faltante - a.faltante || b.requerido - a.requerido);

      return {
        ops_analizadas: ops.map((c) => c.numero),
        ops_no_encontradas: noEncontradas,
        materiales,
        faltantes: materiales.filter((m) => m.faltante > 0),
        productos_sin_bom: [...sinBom],
        nota: "El BOM cargado hoy cubre platinas e impresión 3D; tubería, tornillería y otros insumos aún no están en la BD (esos no aparecen en este cálculo).",
      };
    },
  },
  {
    name: "agenda_entregas",
    modulo: "produccion",
    description:
      "Agenda de entregas e instalaciones: OPs activas con fecha de entrega pactada en los próximos N días (7 por defecto), separando las que requieren instalación, más las vencidas que siguen pendientes. Úsala para '¿qué instalaciones tengo esta semana?', '¿qué se entrega esta semana?', 'agenda de entregas'.",
    input_schema: {
      type: "object",
      properties: {
        dias: {
          type: "integer",
          description: "Horizonte en días hacia adelante (1–60). Por defecto 7.",
        },
      },
      additionalProperties: false,
    },
    claves: [
      "instalacion",
      "instalación",
      "instalaciones",
      "agenda",
      "entregar",
      "entregas esta",
      "semana",
      "proximas entregas",
      "próximas entregas",
    ],
    async ejecutar(input) {
      const dias = Math.max(1, Math.min(60, Number(input.dias) || 7));
      const ops = getOpsRepository();
      const [cards, etapas] = await Promise.all([
        ops.listarOps(),
        ops.listarEtapas(),
      ]);
      const etapaNombre = (id: number) =>
        etapas.find((e) => e.id === id)?.nombre ?? "—";
      const hoy = hoyISO();
      const limite = new Date(Date.now() + dias * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const activas = cards.filter(
        (c) =>
          c.tipo === "op" &&
          !c.anulada &&
          !c.fecha_entregada &&
          c.fecha_entrega_pactada,
      );
      const fila = (c: (typeof activas)[number]) => ({
        numero: c.numero,
        cliente: c.cliente.nombre,
        ciudad: c.ciudad?.nombre ?? null,
        entrega_pactada: c.fecha_entrega_pactada,
        etapa: etapaNombre(c.etapa_id),
        requiere_instalacion: c.requiere_instalacion,
      });
      const enVentana = activas
        .filter(
          (c) =>
            c.fecha_entrega_pactada! >= hoy && c.fecha_entrega_pactada! <= limite,
        )
        .sort((a, b) =>
          a.fecha_entrega_pactada!.localeCompare(b.fecha_entrega_pactada!),
        );

      return {
        horizonte_dias: dias,
        instalaciones: enVentana.filter((c) => c.requiere_instalacion).map(fila),
        entregas_sin_instalacion: enVentana
          .filter((c) => !c.requiere_instalacion)
          .map(fila),
        vencidas_pendientes: activas
          .filter((c) => c.fecha_entrega_pactada! < hoy)
          .sort((a, b) =>
            a.fecha_entrega_pactada!.localeCompare(b.fecha_entrega_pactada!),
          )
          .map(fila)
          .slice(0, 25),
      };
    },
  },
  {
    name: "inventario_materiales",
    modulo: "produccion",
    description:
      "Existencias de materia prima. Por defecto devuelve solo los materiales BAJO BUFFER (hay que reponer), con disponible y buffer mínimo. Úsala para 'qué materiales hay que comprar', 'inventario bajo', 'reponer'.",
    input_schema: {
      type: "object",
      properties: {
        solo_reponer: {
          type: "boolean",
          description: "true (por defecto) = solo lo que está bajo buffer.",
        },
      },
      additionalProperties: false,
    },
    claves: [
      "inventario",
      "material",
      "materiales",
      "materia prima",
      "reponer",
      "comprar",
      "buffer",
      "stock",
      "existencia",
    ],
    async ejecutar(input) {
      const soloReponer = input.solo_reponer !== false;
      const filas = await getInventarioRepository().listarExistenciasMP(
        soloReponer ? { solo_bajo_buffer: true } : {},
      );
      return {
        solo_reponer: soloReponer,
        total: filas.length,
        materiales: filas
          .slice(0, 40)
          .map(({ existencia, material, tipo }) => ({
            material: material.nombre,
            tipo: tipo.nombre,
            disponible: existencia.cantidad_disponible,
            buffer_min: material.buffer_min,
            estado: estadoBuffer(existencia.cantidad_disponible, material),
          })),
      };
    },
  },
  {
    name: "entregas",
    modulo: "produccion",
    description:
      "Resumen mensual de entregas: número de OPs entregadas y valor (COP) por mes, en los últimos N meses. Úsala para 'cuánto entregamos este mes', 'entregas del año', tendencia de despachos.",
    input_schema: {
      type: "object",
      properties: {
        meses: {
          type: "integer",
          description: "Meses a resumir (1–24). Por defecto 12.",
        },
      },
      additionalProperties: false,
    },
    claves: [
      "entrega",
      "entregas",
      "entregamos",
      "entregado",
      "despacho",
      "despachos",
      "reparto",
    ],
    async ejecutar(input) {
      const meses = Math.max(1, Math.min(24, Number(input.meses) || 12));
      const serie = await getEntregasRepository().resumenMensual(meses);
      return { meses, resumen: serie };
    },
  },
  {
    name: "garantias",
    modulo: "produccion",
    description:
      "Garantías (postventa). Por defecto lista las ABIERTAS con cliente, producto, número de OP y días desde apertura. Úsala para 'garantías abiertas', 'reclamos', 'postventa'.",
    input_schema: {
      type: "object",
      properties: {
        estado: {
          type: "string",
          enum: ["abiertas", "cerradas"],
          description: "'abiertas' por defecto.",
        },
      },
      additionalProperties: false,
    },
    claves: [
      "garantia",
      "garantía",
      "garantias",
      "garantías",
      "reclamo",
      "postventa",
      "posventa",
    ],
    async ejecutar(input) {
      const estado = (input.estado as "abiertas" | "cerradas") ?? "abiertas";
      const cards = await getOpsRepository().listarGarantias({ estado });
      return {
        estado,
        total: cards.length,
        garantias: cards.slice(0, 30).map((g) => ({
          numero: g.garantia.numero,
          cliente: g.cliente.nombre,
          producto: g.producto?.nombre ?? null,
          op: g.op_numero,
          problema: g.garantia.problema,
          dias: g.dias,
        })),
      };
    },
  },
  {
    name: "ventas_cotizaciones",
    modulo: "ventas",
    description:
      "Estado comercial: cotizaciones por estado, cuántas están vencidas, valor del pipeline (cotizaciones abiertas) y oportunidades activas en el CRM con su valor total. Úsala para 'cotizaciones', 'pipeline', 'oportunidades', 'embudo'.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    claves: [
      "cotizacion",
      "cotización",
      "cotizaciones",
      "pipeline",
      "oportunidad",
      "oportunidades",
      "crm",
      "embudo",
      "prospecto",
    ],
    async ejecutar() {
      const [cots, oportunidades] = await Promise.all([
        getCotizacionesRepository().listar(),
        getCrmRepository().listarOportunidades(),
      ]);
      const porEstado: Record<string, number> = {};
      let vencidas = 0;
      for (const c of cots) {
        porEstado[c.estado.nombre] = (porEstado[c.estado.nombre] ?? 0) + 1;
        if (c.vencida) vencidas += 1;
      }
      const valorCrm = oportunidades.reduce((s, o) => s + o.valor, 0);
      return {
        cotizaciones: { total: cots.length, por_estado: porEstado, vencidas },
        crm: {
          oportunidades_activas: oportunidades.length,
          valor_total: valorCrm,
        },
      };
    },
  },
  {
    name: "rrhh",
    modulo: "rrhh",
    description:
      "Personal: número de empleados, quiénes están de vacaciones ahora, solicitudes de vacaciones pendientes de aprobar y vacantes abiertas con número de aplicantes. NO expone salarios ni datos confidenciales. Úsala para 'quién está de vacaciones', 'vacantes', 'solicitudes pendientes'.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    claves: [
      "empleado",
      "empleados",
      "vacacion",
      "vacaciones",
      "vacante",
      "vacantes",
      "personal",
      "rrhh",
      "reclutamiento",
      "aplicante",
    ],
    async ejecutar() {
      const repo = getRrhhRepository();
      const [empleados, vacantes] = await Promise.all([
        repo.listarEmpleados(),
        repo.listarVacantes(),
      ]);
      const deVacaciones = empleados
        .filter((e) => e.regresaEl !== null)
        .map((e) => ({ nombre: e.empleado.nombre, regresa_el: e.regresaEl }));
      const kpis = await kpisDashboard(rangoDe("mes"));
      return {
        nota:
          "IMPORTANTE: RRHH aún no está conectado a datos reales — todo lo siguiente es de EJEMPLO. Adviértelo SIEMPRE al responder.",
        empleados: empleados.length,
        de_vacaciones: deVacaciones,
        vacaciones_pendientes: kpis.rrhh.vacaciones_pendientes,
        vacantes: vacantes.map((v) => ({
          cargo: v.vacante.cargo,
          area: v.vacante.area,
          aplicantes: v.aplicaciones.length,
        })),
      };
    },
  },
];

// ---------------------------------------------------------------
// Selección y ejecución con permisos
// ---------------------------------------------------------------

/** Herramientas visibles para un usuario según los módulos que puede ver. */
export function herramientasPara(modulos: Modulo[]): HerramientaChat[] {
  return HERRAMIENTAS.filter((h) => modulos.includes(h.modulo));
}

/** Definiciones para la API de Anthropic (solo las permitidas). */
export function toolDefs(modulos: Modulo[]) {
  return herramientasPara(modulos).map((h) => ({
    name: h.name,
    description: h.description,
    input_schema: h.input_schema,
  }));
}

/**
 * Ejecuta una herramienta respetando permisos. Devuelve SIEMPRE un string
 * (JSON) apto para un `tool_result`. Nunca lanza: los errores viajan como
 * `{ error }` para que el modelo pueda explicarlos.
 */
export async function ejecutarHerramienta(
  name: string,
  input: Record<string, unknown>,
  modulos: Modulo[],
): Promise<string> {
  const h = HERRAMIENTAS.find((x) => x.name === name);
  if (!h) return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  if (!modulos.includes(h.modulo)) {
    return JSON.stringify({
      error: `No tienes permiso para consultar el módulo '${h.modulo}'.`,
    });
  }
  try {
    const data = await h.ejecutar(input ?? {});
    return JSON.stringify(data);
  } catch (e) {
    return JSON.stringify({
      error: `Error al consultar '${name}': ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

// ---------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------

export function systemPrompt(modulos: Modulo[]): string {
  const disponibles = herramientasPara(modulos)
    .map((h) => `- ${h.name}: ${h.description.split(".")[0]}.`)
    .join("\n");
  const hoy = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return [
    "Eres el asistente de Claude embebido en el ERP de Bravefit, un fabricante de equipos de gimnasio en Medellín, Colombia. Su producto principal es el Rack.",
    `Hoy es ${hoy}.`,
    "",
    "Tu trabajo es responder preguntas del equipo sobre los datos del ERP consultando las herramientas disponibles. NUNCA inventes cifras: si no tienes el dato, usa una herramienta; si aún así no lo tienes, dilo.",
    "",
    "Reglas de estilo:",
    "- Responde en español, de forma breve y directa. Ve al grano.",
    "- Formatea el dinero en pesos colombianos: $28.400.000 (sin decimales, puntos de miles).",
    "- Usa listas o tablas cortas cuando ayuden a leer cifras; no escribas párrafos largos.",
    "- Si el usuario pide una acción que aún no puedes hacer (crear cotizaciones, mover OPs), explícale que por ahora solo puedes consultar información.",
    "",
    "Herramientas que puedes usar (según los permisos de este usuario):",
    disponibles || "(ninguna — este usuario no tiene módulos visibles)",
  ].join("\n");
}

// ---------------------------------------------------------------
// Modo demo (sin ANTHROPIC_API_KEY)
// ---------------------------------------------------------------

/**
 * Responde sin llamar a la API real: hace intent-match por palabras clave a
 * una herramienta permitida, la ejecuta y arma un resumen legible. Permite
 * probar el chat sobre datos mock hoy; cuando Juan configure la API key, la
 * ruta usa Claude de verdad y este modo queda como fallback.
 */
export async function responderDemo(
  pregunta: string,
  modulos: Modulo[],
): Promise<{ reply: string; herramienta: string | null }> {
  const permitidas = herramientasPara(modulos);
  if (permitidas.length === 0) {
    return {
      reply: "No tienes módulos habilitados para consultar.",
      herramienta: null,
    };
  }
  const q = pregunta.toLowerCase();
  const elegida =
    permitidas.find((h) => h.claves.some((k) => q.includes(k))) ??
    permitidas[0];

  const data = JSON.parse(await ejecutarHerramienta(elegida.name, {}, modulos));
  const reply = resumirDemo(elegida.name, data);
  return { reply, herramienta: elegida.name };
}

function cop(n: number): string {
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
}

/** Resúmenes en español para el modo demo (uno por herramienta). */
function resumirDemo(
  name: string,
  d: Record<string, unknown> & { error?: string },
): string {
  if (d?.error) return String(d.error);
  const nota =
    "\n\n— Modo demostración: respuesta generada localmente sobre datos de ejemplo. Al configurar la API key de Anthropic, el chat usará Claude.";

  switch (name) {
    case "resumen_general": {
      const v = d.ventas as {
        total_periodo: number;
        pedidos: number;
        ticket_promedio: number;
      };
      const p = d.produccion as { ops_activas: number; vencidas: number };
      const l = d.logistica as {
        entregas_mes: number;
        garantias_abiertas: number;
      };
      return (
        `**Resumen (${d.periodo})**\n` +
        `- Ventas: ${cop(v.total_periodo)} en ${v.pedidos} pedidos (ticket ${cop(v.ticket_promedio)})\n` +
        `- Producción: ${p.ops_activas} OPs activas, ${p.vencidas} vencidas\n` +
        `- Logística: ${l.entregas_mes} entregas este mes, ${l.garantias_abiertas} garantías abiertas` +
        nota
      );
    }
    case "capacidad_planta": {
      const t = d.tuberia_70x70 as {
        techo_m: number;
        mes_techo: string;
        promedio_m: number;
        meses_sobre_capacidad: number;
        ultimos_meses: {
          mes: string;
          procesada_m: number;
          vendida_m: number;
        }[];
      };
      const cuellos = d.cuellos_botella as {
        nombre: string;
        total: number;
        promedio_mensual: number;
      }[];
      const filas = t.ultimos_meses
        .map(
          (m) =>
            `  · ${m.mes}: ${m.procesada_m} m procesados / ${m.vendida_m} m vendidos`,
        )
        .join("\n");
      const listaCuellos = cuellos
        .map(
          (c) =>
            `  · ${c.nombre}: ${Math.round(c.promedio_mensual)}/mes (total ${c.total})`,
        )
        .join("\n");
      return (
        `**Capacidad de planta — tubería 70×70**\n` +
        `Techo demostrado: ${t.techo_m} m (${t.mes_techo}). Promedio: ${t.promedio_m} m/mes. ` +
        `${t.meses_sobre_capacidad} meses la demanda superó lo procesado.\n${filas}\n\n` +
        `**Cuellos de botella (prom. mensual):**\n${listaCuellos}` +
        nota
      );
    }
    case "ordenes_produccion": {
      const lista =
        (d.lista_vencidas as {
          numero: string;
          cliente: string;
          entrega_pactada: string;
        }[]) ?? [];
      const filas = lista
        .slice(0, 8)
        .map(
          (o) =>
            `  · ${o.numero} — ${o.cliente} (pactada ${o.entrega_pactada})`,
        )
        .join("\n");
      return (
        `**Producción**\n` +
        `- Activas: ${d.activas} · En cola: ${d.en_cola}\n` +
        `- Vencidas: ${d.vencidas} · Próximas a vencer: ${d.proximas_a_vencer}` +
        (filas ? `\n\nOPs vencidas:\n${filas}` : "") +
        nota
      );
    }
    case "inventario_materiales": {
      const mats =
        (d.materiales as {
          material: string;
          disponible: number;
          buffer_min: number;
        }[]) ?? [];
      if (mats.length === 0)
        return "No hay materiales bajo el buffer mínimo ahora mismo." + nota;
      const filas = mats
        .slice(0, 12)
        .map((m) => `  · ${m.material}: ${m.disponible} (mín ${m.buffer_min})`)
        .join("\n");
      return `**Materiales por reponer (${d.total})**\n${filas}` + nota;
    }
    case "entregas": {
      const serie =
        (d.resumen as { mes: string; entregas: number; valor: number }[]) ?? [];
      const filas = serie
        .slice(-6)
        .map((m) => `  · ${m.mes}: ${m.entregas} entregas — ${cop(m.valor)}`)
        .join("\n");
      return `**Entregas por mes (últimos ${d.meses})**\n${filas}` + nota;
    }
    case "garantias": {
      const gs =
        (d.garantias as {
          numero: string;
          cliente: string;
          problema: string;
          dias: number;
        }[]) ?? [];
      if (gs.length === 0) return `No hay garantías ${d.estado}.` + nota;
      const filas = gs
        .slice(0, 10)
        .map(
          (g) => `  · ${g.numero} — ${g.cliente} (${g.dias} d): ${g.problema}`,
        )
        .join("\n");
      return `**Garantías ${d.estado} (${d.total})**\n${filas}` + nota;
    }
    case "ventas_cotizaciones": {
      const c = d.cotizaciones as {
        total: number;
        vencidas: number;
        por_estado: Record<string, number>;
      };
      const crm = d.crm as {
        oportunidades_activas: number;
        valor_total: number;
      };
      const estados = Object.entries(c.por_estado)
        .map(([k, n]) => `${k}: ${n}`)
        .join(", ");
      return (
        `**Comercial**\n` +
        `- Cotizaciones: ${c.total} (${estados}). Vencidas: ${c.vencidas}\n` +
        `- CRM: ${crm.oportunidades_activas} oportunidades activas por ${cop(crm.valor_total)}` +
        nota
      );
    }
    case "rrhh": {
      const vac =
        (d.de_vacaciones as { nombre: string; regresa_el: string }[]) ?? [];
      const vacantes =
        (d.vacantes as { cargo: string; aplicantes: number }[]) ?? [];
      const enVac = vac.length
        ? vac.map((v) => `${v.nombre} (regresa ${v.regresa_el})`).join(", ")
        : "nadie";
      const vs =
        vacantes
          .map((v) => `${v.cargo} (${v.aplicantes} aplicantes)`)
          .join(", ") || "ninguna";
      return (
        `**RRHH**\n` +
        `- Empleados: ${d.empleados}\n` +
        `- De vacaciones: ${enVac}\n` +
        `- Solicitudes pendientes: ${d.vacaciones_pendientes}\n` +
        `- Vacantes: ${vs}` +
        nota
      );
    }
    default:
      return "No encontré cómo responder eso." + nota;
  }
}
