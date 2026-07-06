/**
 * Data layer de Pedidos Web (Shopify) — INTERCAMBIABLE.
 *
 * Reglas del dueño: ver estado, cliente y pago; los pedidos PAGADOS se
 * convierten en OP automáticamente (origen 'shopify', entran a "En Cola").
 * La pantalla muestra: nuevas SIN entregar, histórico del año, y analítica
 * estilo Shopify (sesiones, ventas, pedidos, conversión) con comparativo
 * del periodo anterior + serie temporal (actual vs anterior).
 *
 * En producción el webhook de Shopify crea el pedido y un worker con
 * service_role dispara la OP; aquí el mock lo replica con getOpsRepository.
 */

import { CLIENTES, getOpsRepository, PRODUCTOS } from "@/lib/data/ops";
import type { Cliente, PedidoWeb, Producto } from "@/lib/types/db";

// ---------------------------------------------------------------
// Tipos para la UI
// ---------------------------------------------------------------

export interface PedidoLinea {
  producto_id: string;
  cantidad: number;
  precio_unit: number;
}

export interface PedidoWebCard {
  pedido: PedidoWeb;
  cliente: Cliente | null;
  items: { producto: Producto; cantidad: number; precio_unit: number }[];
  /** Pagado y sin OP: candidato a "Generar O.P.". */
  convertible: boolean;
}

export interface MetricaComparada {
  valor: number;
  anterior: number;
  /** Variación % vs periodo anterior (null si el anterior es 0). */
  variacion: number | null;
}

export interface AnaliticaShopify {
  sesiones: MetricaComparada;
  ventas: MetricaComparada;
  pedidos: MetricaComparada;
  conversion: MetricaComparada; // %
  /** Serie diaria alineada por offset de día dentro del periodo. */
  serie: { dia: number; fecha: string; actual: number; anterior: number }[];
  etiquetaActual: string;
  etiquetaAnterior: string;
}

export type PeriodoClave = "30d" | "90d" | "anio";

export interface FiltrosPedidos {
  estado_pago?: PedidoWeb["estado_pago"];
  solo_sin_entregar?: boolean;
  texto?: string;
}

export interface ShopifyRepository {
  listarPedidos(filtros?: FiltrosPedidos): Promise<PedidoWebCard[]>;
  /** Genera la OP de un pedido pagado y la vincula (idempotente). */
  generarOp(pedido_id: string): Promise<{ op_id: string; numero: string }>;
  analitica(periodo: PeriodoClave): Promise<AnaliticaShopify>;
}

// ===============================================================
// MOCK — pedidos de e-commerce Bravefit (hogar / comercializado)
// ===============================================================

const MS_DIA = 86_400_000;
const hoy0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** PRNG determinista (mismo patrón que otros mocks): sesiones estables. */
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fechaRelISO(dias: number): string {
  const d = hoy0();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

interface PedidoSeed {
  id: string;
  numero: string;
  cliente_id: string | null;
  pago: PedidoWeb["estado_pago"];
  entrega: PedidoWeb["estado_entrega"];
  op_id?: string;
  hace: number; // días atrás
  items: PedidoLinea[];
}

// productos que se venden por la web (comercializados + hogar)
function ln(producto_id: string, cantidad: number): PedidoLinea {
  const p = PRODUCTOS.find((x) => x.id === producto_id)!;
  return { producto_id, cantidad, precio_unit: p.precio_lista };
}

const totalDe = (items: PedidoLinea[]) =>
  items.reduce((a, i) => a + i.cantidad * i.precio_unit, 0);

// Pedidos "vivos" nombrados (los recientes que se ven en la pantalla)
const SEED_RECIENTES: PedidoSeed[] = [
  // pagados SIN OP → convertibles (el flujo automático los tomaría)
  { id: "pw-01", numero: "#1048", cliente_id: "c-10", pago: "pagado", entrega: "sin_entregar", hace: 0, items: [ln("p-07", 1), ln("p-08", 1)] },
  { id: "pw-02", numero: "#1047", cliente_id: "c-03", pago: "pagado", entrega: "sin_entregar", hace: 1, items: [ln("p-12", 1)] },
  { id: "pw-03", numero: "#1046", cliente_id: "c-06", pago: "pagado", entrega: "sin_entregar", hace: 2, items: [ln("p-05", 2), ln("p-10", 1)] },
  // pendiente de pago → NO convertible aún
  { id: "pw-04", numero: "#1045", cliente_id: "c-14", pago: "pendiente", entrega: "sin_entregar", hace: 1, items: [ln("p-06", 1)] },
  // pagados YA convertidos a OP (muestran su OP vinculada)
  { id: "pw-05", numero: "#1044", cliente_id: "c-06", pago: "pagado", entrega: "sin_entregar", op_id: "op-03", hace: 3, items: [ln("p-04", 1), ln("p-07", 1)] },
  { id: "pw-06", numero: "#1043", cliente_id: "c-12", pago: "pagado", entrega: "entregado", op_id: "op-06", hace: 30, items: [ln("p-05", 1)] },
  // reembolsado
  { id: "pw-07", numero: "#1042", cliente_id: "c-03", pago: "reembolsado", entrega: "sin_entregar", hace: 8, items: [ln("p-12", 1)] },
];

/** Genera pedidos históricos (para el año e histórico), deterministas. */
function generarHistoricos(): PedidoSeed[] {
  const rnd = mulberry(20260705);
  const combos: string[][] = [
    ["p-07", "p-08"], ["p-12"], ["p-05"], ["p-06"], ["p-10"],
    ["p-07"], ["p-05", "p-10"], ["p-08"], ["p-12", "p-07"], ["p-04"],
  ];
  const out: PedidoSeed[] = [];
  let n = 1041;
  // ~400 días atrás → ayer; densidad variable con un pico a mitad de junio
  for (let d = 400; d >= 4; d--) {
    // probabilidad de pedido ese día (0–2 pedidos)
    const base = 0.22;
    const pico = d > 20 && d < 28 ? 0.7 : 0; // "spike" tipo Shopify
    const cuantos = rnd() < base + pico ? (rnd() < 0.25 ? 2 : 1) : 0;
    for (let k = 0; k < cuantos; k++) {
      const combo = combos[Math.floor(rnd() * combos.length)];
      const cliente = CLIENTES[Math.floor(rnd() * CLIENTES.length)];
      const items = combo.map((pid) => ln(pid, rnd() < 0.3 ? 2 : 1));
      const pago: PedidoWeb["estado_pago"] = rnd() < 0.9 ? "pagado" : rnd() < 0.5 ? "pendiente" : "reembolsado";
      out.push({
        id: `pwh-${n}`,
        numero: `#${n}`,
        cliente_id: cliente.id,
        pago,
        entrega: pago === "pagado" ? "entregado" : "sin_entregar",
        op_id: pago === "pagado" ? `oph-${n}` : undefined,
        hace: d,
        items,
      });
      n--;
      if (n < 900) n = 1040; // evita choque con los recientes
    }
  }
  return out;
}

function seedToPedido(s: PedidoSeed): PedidoWeb {
  return {
    id: s.id,
    shopify_order_id: `gid://shopify/Order/${s.id}`,
    shopify_numero: s.numero,
    cliente_id: s.cliente_id,
    estado_pago: s.pago,
    estado_entrega: s.entrega,
    total: totalDe(s.items),
    op_id: s.op_id ?? null,
    recibido_en: fechaRelISO(-s.hace),
  };
}

interface ShopifyStore {
  pedidos: PedidoWeb[];
  itemsPorPedido: Map<string, PedidoLinea[]>;
}

const g = globalThis as unknown as {
  __shopifyStore?: ShopifyStore;
  __shopifyRepositorio?: ShopifyRepository;
};

function getStore(): ShopifyStore {
  if (!g.__shopifyStore) {
    const seeds = [...SEED_RECIENTES, ...generarHistoricos()];
    g.__shopifyStore = {
      pedidos: seeds.map(seedToPedido),
      itemsPorPedido: new Map(seeds.map((s) => [s.id, s.items])),
    };
  }
  return g.__shopifyStore;
}

// sesiones diarias sintéticas (tráfico web, deterministas por fecha)
function sesionesDelDia(fechaISO: string): number {
  const dia = new Date(fechaISO);
  const semilla = dia.getFullYear() * 1000 + dia.getMonth() * 40 + dia.getDate();
  const r = mulberry(semilla)();
  const finde = [0, 6].includes(dia.getDay());
  return Math.round((finde ? 60 : 110) + r * 90);
}

const inicioDiaISO = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export class MockShopifyRepository implements ShopifyRepository {
  private get store() {
    return getStore();
  }

  private card(p: PedidoWeb): PedidoWebCard {
    const items = (this.store.itemsPorPedido.get(p.id) ?? []).map((i) => ({
      producto: PRODUCTOS.find((x) => x.id === i.producto_id)!,
      cantidad: i.cantidad,
      precio_unit: i.precio_unit,
    }));
    return {
      pedido: structuredClone(p),
      cliente: CLIENTES.find((c) => c.id === p.cliente_id) ?? null,
      items,
      convertible: p.estado_pago === "pagado" && !p.op_id,
    };
  }

  async listarPedidos(filtros: FiltrosPedidos = {}): Promise<PedidoWebCard[]> {
    const q = filtros.texto?.trim().toLowerCase();
    return this.store.pedidos
      .filter((p) => !filtros.estado_pago || p.estado_pago === filtros.estado_pago)
      .filter(
        (p) =>
          !filtros.solo_sin_entregar ||
          (p.estado_pago === "pagado" && p.estado_entrega !== "entregado"),
      )
      .filter((p) => {
        if (!q) return true;
        const cli = CLIENTES.find((c) => c.id === p.cliente_id)?.nombre ?? "";
        return `${p.shopify_numero} ${cli}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.recibido_en.localeCompare(a.recibido_en))
      .map((p) => this.card(p));
  }

  async generarOp(pedido_id: string): Promise<{ op_id: string; numero: string }> {
    const p = this.store.pedidos.find((x) => x.id === pedido_id);
    if (!p) throw new Error("Pedido no encontrado");
    if (p.estado_pago !== "pagado") {
      throw new Error(`El pedido ${p.shopify_numero} no está pagado`);
    }
    if (p.op_id) {
      const existente = await getOpsRepository().obtenerOp(p.op_id);
      if (existente) return { op_id: p.op_id, numero: existente.op.numero };
    }
    const cliente = CLIENTES.find((c) => c.id === p.cliente_id);
    const items = this.store.itemsPorPedido.get(p.id) ?? [];
    const op = await getOpsRepository().crearOp({
      cliente_id: p.cliente_id ?? "c-10",
      ciudad_id: cliente?.ciudad_id ?? null,
      segmento: "B2C", // e-commerce = consumidor final
      origen_clave: "shopify",
      cotizacion_id: null,
      vendedor_id: null, // e-commerce sin vendedor → Tienda online
      notas: `OP generada automáticamente desde el pedido Shopify ${p.shopify_numero}.`,
      items: items.map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unit: i.precio_unit,
      })),
    });
    p.op_id = op.id;
    return { op_id: op.id, numero: op.numero };
  }

  async analitica(periodo: PeriodoClave): Promise<AnaliticaShopify> {
    const dias = periodo === "30d" ? 30 : periodo === "90d" ? 90 : 365;
    const fin = hoy0();
    const inicioActual = new Date(fin.getTime() - (dias - 1) * MS_DIA);
    const inicioAnterior = new Date(inicioActual.getTime() - dias * MS_DIA);

    const pagadosEntre = (desde: Date, hasta: Date) =>
      this.store.pedidos.filter(
        (p) =>
          p.estado_pago === "pagado" &&
          new Date(p.recibido_en) >= desde &&
          new Date(p.recibido_en) <= hasta,
      );

    const finAnterior = new Date(inicioActual.getTime() - MS_DIA);
    const actuales = pagadosEntre(inicioActual, fin);
    const anteriores = pagadosEntre(inicioAnterior, finAnterior);

    let sesActual = 0;
    let sesAnterior = 0;
    const serie: AnaliticaShopify["serie"] = [];
    for (let i = 0; i < dias; i++) {
      const dA = inicioDiaISO(new Date(inicioActual.getTime() + i * MS_DIA));
      const dP = inicioDiaISO(new Date(inicioAnterior.getTime() + i * MS_DIA));
      const isoA = dA.toISOString();
      const isoP = dP.toISOString();
      sesActual += sesionesDelDia(isoA);
      sesAnterior += sesionesDelDia(isoP);
      const ventasDiaA = actuales
        .filter((p) => inicioDiaISO(new Date(p.recibido_en)).getTime() === dA.getTime())
        .reduce((a, p) => a + p.total, 0);
      const ventasDiaP = anteriores
        .filter((p) => inicioDiaISO(new Date(p.recibido_en)).getTime() === dP.getTime())
        .reduce((a, p) => a + p.total, 0);
      // muestreo del eje: guardamos todos, la UI decide etiquetas
      serie.push({ dia: i, fecha: isoA.slice(0, 10), actual: ventasDiaA, anterior: ventasDiaP });
    }

    const ventasActual = actuales.reduce((a, p) => a + p.total, 0);
    const ventasAnterior = anteriores.reduce((a, p) => a + p.total, 0);
    const convActual = sesActual > 0 ? (actuales.length / sesActual) * 100 : 0;
    const convAnterior = sesAnterior > 0 ? (anteriores.length / sesAnterior) * 100 : 0;

    const cmp = (v: number, a: number): MetricaComparada => ({
      valor: v,
      anterior: a,
      variacion: a === 0 ? null : ((v - a) / a) * 100,
    });

    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(d);
    return {
      sesiones: cmp(sesActual, sesAnterior),
      ventas: cmp(ventasActual, ventasAnterior),
      pedidos: cmp(actuales.length, anteriores.length),
      conversion: cmp(Math.round(convActual * 100) / 100, Math.round(convAnterior * 100) / 100),
      serie,
      etiquetaActual: `${fmt(inicioActual)} – ${fmt(fin)}`,
      etiquetaAnterior: `${fmt(inicioAnterior)} – ${fmt(finAnterior)}`,
    };
  }
}

export function getShopifyRepository(): ShopifyRepository {
  g.__shopifyRepositorio ??= new MockShopifyRepository();
  return g.__shopifyRepositorio;
}
