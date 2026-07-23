/**
 * Data layer de Solicitudes de Compra — INTERCAMBIABLE (patrón ops.ts).
 *
 * Reglas del dueño (REQUISITOS §5):
 *  · UNA solicitud por TIPO de material; al expandir se ve la lista interna.
 *  · valor_estimado lo digita el comprador cuando le cotizan proveedores.
 *  · Estados: pendiente → en_cotizacion → comprado (habilita fecha_entrega);
 *    rechazada desde pendiente/en_cotizacion.
 *  · Recepción: logística chequea ÍTEM POR ÍTEM; faltantes quedan en
 *    seguimiento hasta resolverse (la SC solo "cierra" sin faltantes).
 */

import { VENDEDORES } from "@/lib/data/crm-cotizaciones";
import {
  MATERIALES,
  PROVEEDORES,
  TIPOS_MATERIAL,
} from "@/lib/data/materiales-mock";
import { fechaRel, tsRel } from "@/lib/data/ops";
import type {
  Material,
  Proveedor,
  Recepcion,
  RecepcionItem,
  ScItem,
  SolicitudCompra,
  TipoMaterial,
  Usuario,
} from "@/lib/types/db";

// ---------------------------------------------------------------
// Tipos enriquecidos para la UI
// ---------------------------------------------------------------

export interface ScItemDetalle extends ScItem {
  material: Material | null;
  recibido: number; // Σ cant_recibida de todas las recepciones
  faltante_abierto: number; // Σ cant_faltante sin resolver
}

export interface SolicitudCard {
  sc: SolicitudCompra;
  tipo: TipoMaterial;
  proveedor: Proveedor | null;
  solicitante: Usuario;
  items: ScItemDetalle[];
  unidades_pedidas: number;
  unidades_recibidas: number;
  faltantes_abiertos: number;
  recepciones: Recepcion[];
  /** completa = todo recibido y sin faltantes abiertos. */
  recepcion_completa: boolean;
}

export interface FaltanteCard {
  recepcion_item: RecepcionItem;
  sc_id: string;
  sc_numero: string;
  material_nombre: string;
  fecha_recepcion: string;
}

export interface FiltrosCompras {
  estado?: SolicitudCompra["estado"];
  tipo_material_id?: number;
  texto?: string;
}

/** Días que una SC cerrada sigue en la lista antes del Archivo. */
export const ARCHIVO_DIAS_SC = 7;

/**
 * Una SC sale del listado activo cuando ya es historia: rechazada (se
 * archiva de inmediato — no estorba, pero queda consultable) o
 * comprada y recibida completa hace más de ARCHIVO_DIAS_SC.
 */
export function esScArchivada(c: SolicitudCard, hoy = new Date()): boolean {
  if (c.sc.estado === "rechazada") return true;
  if (c.sc.estado !== "comprado" || !c.recepcion_completa) return false;
  const ultima = c.recepciones[0]?.fecha ?? c.sc.creado_en;
  return (
    (hoy.getTime() - new Date(ultima).getTime()) / 86_400_000 >
    ARCHIVO_DIAS_SC
  );
}

export interface ScItemInput {
  material_id: string | null;
  descripcion: string | null;
  cantidad: number;
}

export interface RecepcionItemInput {
  sc_item_id: string;
  cant_recibida: number;
  cant_faltante: number;
  nota: string | null;
  /**
   * Costo unitario de la factura, opcional. Si viene, alimenta el promedio
   * ponderado del material; si no, la entrada al kardex se registra al costo
   * promedio vigente (no mueve el promedio) y queda anotada como tal.
   */
  costo_unit?: number | null;
}

export interface ComprasRepository {
  listar(filtros?: FiltrosCompras): Promise<SolicitudCard[]>;
  crear(input: {
    tipo_material_id: number;
    notas: string | null;
    items: ScItemInput[];
  }): Promise<{ id: string; numero: string }>;
  cambiarEstado(
    id: string,
    estado: SolicitudCompra["estado"],
    datos?: {
      valor_estimado?: number;
      fecha_entrega?: string;
      proveedor_id?: string | null;
    },
  ): Promise<void>;
  registrarRecepcion(sc_id: string, items: RecepcionItemInput[]): Promise<void>;
  resolverFaltante(recepcion_item_id: string, nota?: string): Promise<void>;
  listarFaltantes(): Promise<FaltanteCard[]>;
  listarTiposMaterial(): Promise<TipoMaterial[]>;
  listarMateriales(): Promise<Material[]>;
  listarProveedores(): Promise<Proveedor[]>;
}

// ===============================================================
// MOCK
// ===============================================================

interface ScSeed {
  id: string;
  numero: string;
  tipo_material_id: number;
  estado: SolicitudCompra["estado"];
  solicitante_id: string;
  creada: number;
  proveedor_id?: string;
  valor_estimado?: number;
  fecha_entrega?: number; // días relativos
  op_id?: string;
  notas?: string;
}

function scSeed(s: ScSeed): SolicitudCompra {
  return {
    id: s.id,
    numero: s.numero,
    tipo_material_id: s.tipo_material_id,
    proveedor_id: s.proveedor_id ?? null,
    solicitante_id: s.solicitante_id,
    estado: s.estado,
    valor_estimado: s.valor_estimado ?? null,
    fecha_entrega: s.fecha_entrega === undefined ? null : fechaRel(s.fecha_entrega),
    op_id: s.op_id ?? null,
    notas: s.notas ?? null,
    activo: true,
    eliminado_en: null,
    creado_en: tsRel(s.creada, 9),
  };
}

const SOLICITUDES: SolicitudCompra[] = [
  scSeed({ id: "sc-01", numero: "SC-011", tipo_material_id: 1, estado: "pendiente", solicitante_id: "u-02", creada: -1, notas: "Tubería para las 3 OPs de racks que entran a Corte la otra semana." }),
  scSeed({ id: "sc-02", numero: "SC-012", tipo_material_id: 4, estado: "pendiente", solicitante_id: "u-03", creada: -2 }),
  scSeed({ id: "sc-03", numero: "SC-013", tipo_material_id: 6, estado: "en_cotizacion", solicitante_id: "u-02", creada: -4, notas: "FerreMax y Aceros del Valle cotizando." }),
  scSeed({ id: "sc-04", numero: "SC-014", tipo_material_id: 7, estado: "comprado", solicitante_id: "u-02", creada: -10, proveedor_id: "pr-03", valor_estimado: 1_450_000, fecha_entrega: 3, notas: "Incluye la roja RAL para el pedido del hotel." }),
  scSeed({ id: "sc-05", numero: "SC-015", tipo_material_id: 3, estado: "comprado", solicitante_id: "u-03", creada: -12, proveedor_id: "pr-04", valor_estimado: 1_030_000, fecha_entrega: -2, notas: "Tapizados para bancos de OP-1041 y OP-1047." }),
  scSeed({ id: "sc-06", numero: "SC-016", tipo_material_id: 2, estado: "comprado", solicitante_id: "u-02", creada: -18, proveedor_id: "pr-01", valor_estimado: 2_780_000, fecha_entrega: -8 }),
  scSeed({ id: "sc-07", numero: "SC-017", tipo_material_id: 5, estado: "rechazada", solicitante_id: "u-03", creada: -15, notas: "Rechazada: aún hay stock de UHMW para 2 meses." }),
  scSeed({ id: "sc-08", numero: "SC-018", tipo_material_id: 8, estado: "pendiente", solicitante_id: "u-01", creada: 0, op_id: "op-03", notas: "Barra comercializada para OP-1043 (esperando proveedor)." }),
];

function item(id: string, sc_id: string, material_id: string | null, cantidad: number, descripcion?: string): ScItem {
  return { id, sc_id, material_id, descripcion: descripcion ?? null, cantidad };
}

const SC_ITEMS: ScItem[] = [
  item("sci-01a", "sc-01", "m-01", 120),
  item("sci-01b", "sc-01", "m-02", 60),
  item("sci-01c", "sc-01", "m-03", 30),
  item("sci-02a", "sc-02", "m-08", 400),
  item("sci-02b", "sc-02", "m-09", 400),
  item("sci-02c", "sc-02", "m-10", 150),
  item("sci-03a", "sc-03", "m-13", 4),
  item("sci-03b", "sc-03", "m-14", 30),
  item("sci-04a", "sc-04", "m-15", 50),
  item("sci-04b", "sc-04", "m-16", 15),
  item("sci-05a", "sc-05", "m-06", 10),
  item("sci-05b", "sc-05", "m-07", 6),
  item("sci-06a", "sc-06", "m-04", 150),
  item("sci-06b", "sc-06", "m-05", 80),
  item("sci-07a", "sc-07", "m-11", 40),
  item("sci-08a", "sc-08", null, 1, "Barra olímpica profesional negra 20 kg — proveedor externo"),
];

// SC-015: recepción PARCIAL con faltante abierto (seguimiento).
// SC-016: recepción COMPLETA en dos entregas.
const RECEPCIONES: Recepcion[] = [
  { id: "rc-01", sc_id: "sc-05", usuario_id: "u-03", fecha: tsRel(-1, 10), cerrada: false },
  { id: "rc-02", sc_id: "sc-06", usuario_id: "u-02", fecha: tsRel(-6, 15), cerrada: false },
  { id: "rc-03", sc_id: "sc-06", usuario_id: "u-02", fecha: tsRel(-3, 11), cerrada: true },
];

const RECEPCION_ITEMS: RecepcionItem[] = [
  // SC-015: llegaron 10 tapizados de banco plano, pero solo 3 de ajustable
  { id: "rci-01", recepcion_id: "rc-01", sc_item_id: "sci-05a", cant_recibida: 10, cant_faltante: 0, nota: null, faltante_resuelto: false },
  { id: "rci-02", recepcion_id: "rc-01", sc_item_id: "sci-05b", cant_recibida: 3, cant_faltante: 3, nota: "El Cojín quedó de enviar los 3 restantes esta semana.", faltante_resuelto: false },
  // SC-016: primera entrega parcial, segunda completa el faltante
  { id: "rci-03", recepcion_id: "rc-02", sc_item_id: "sci-06a", cant_recibida: 100, cant_faltante: 50, nota: null, faltante_resuelto: true },
  { id: "rci-04", recepcion_id: "rc-02", sc_item_id: "sci-06b", cant_recibida: 80, cant_faltante: 0, nota: null, faltante_resuelto: false },
  { id: "rci-05", recepcion_id: "rc-03", sc_item_id: "sci-06a", cant_recibida: 50, cant_faltante: 0, nota: "Llegó el resto de platina.", faltante_resuelto: false },
];

// ---------------------------------------------------------------
// Store singleton (sobrevive HMR; el server action muta aquí)
// ---------------------------------------------------------------

interface ComprasStore {
  solicitudes: SolicitudCompra[];
  items: ScItem[];
  recepciones: Recepcion[];
  recepcionItems: RecepcionItem[];
}

const g = globalThis as unknown as {
  __comprasStore?: ComprasStore;
  __comprasRepositorio?: ComprasRepository;
};

function getStore(): ComprasStore {
  g.__comprasStore ??= {
    solicitudes: structuredClone(SOLICITUDES),
    items: structuredClone(SC_ITEMS),
    recepciones: structuredClone(RECEPCIONES),
    recepcionItems: structuredClone(RECEPCION_ITEMS),
  };
  return g.__comprasStore;
}

export class MockComprasRepository implements ComprasRepository {
  private get store() {
    return getStore();
  }

  private itemDetalle(it: ScItem): ScItemDetalle {
    const recItems = this.store.recepcionItems.filter((r) => r.sc_item_id === it.id);
    return {
      ...it,
      material: MATERIALES.find((m) => m.id === it.material_id) ?? null,
      recibido: recItems.reduce((a, r) => a + r.cant_recibida, 0),
      faltante_abierto: recItems
        .filter((r) => !r.faltante_resuelto)
        .reduce((a, r) => a + r.cant_faltante, 0),
    };
  }

  private card(sc: SolicitudCompra): SolicitudCard {
    const items = this.store.items
      .filter((i) => i.sc_id === sc.id)
      .map((i) => this.itemDetalle(i));
    const pedidas = items.reduce((a, i) => a + i.cantidad, 0);
    const recibidas = items.reduce((a, i) => a + i.recibido, 0);
    const faltantes = items.reduce((a, i) => a + i.faltante_abierto, 0);
    return {
      sc: structuredClone(sc),
      tipo: TIPOS_MATERIAL.find((t) => t.id === sc.tipo_material_id)!,
      proveedor: PROVEEDORES.find((p) => p.id === sc.proveedor_id) ?? null,
      solicitante: VENDEDORES.find((v) => v.id === sc.solicitante_id) ?? VENDEDORES[0],
      items,
      unidades_pedidas: pedidas,
      unidades_recibidas: recibidas,
      faltantes_abiertos: faltantes,
      recepciones: this.store.recepciones
        .filter((r) => r.sc_id === sc.id)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
      recepcion_completa: pedidas > 0 && recibidas >= pedidas && faltantes === 0,
    };
  }

  async listar(filtros: FiltrosCompras = {}): Promise<SolicitudCard[]> {
    const q = filtros.texto?.trim().toLowerCase();
    return this.store.solicitudes
      .filter((s) => s.activo)
      .map((s) => this.card(s))
      .filter((c) => {
        if (filtros.estado && c.sc.estado !== filtros.estado) return false;
        if (
          filtros.tipo_material_id !== undefined &&
          c.sc.tipo_material_id !== filtros.tipo_material_id
        )
          return false;
        if (q) {
          const blob = [
            c.sc.numero,
            c.tipo.nombre,
            c.proveedor?.nombre ?? "",
            c.sc.notas ?? "",
            ...c.items.map((i) => i.material?.nombre ?? i.descripcion ?? ""),
          ]
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.sc.creado_en.localeCompare(a.sc.creado_en));
  }

  async crear(input: {
    tipo_material_id: number;
    notas: string | null;
    items: ScItemInput[];
  }): Promise<{ id: string; numero: string }> {
    if (!TIPOS_MATERIAL.some((t) => t.id === input.tipo_material_id)) {
      throw new Error("Seleccione el tipo de material");
    }
    if (input.items.length === 0) {
      throw new Error("Agregue al menos un ítem a la solicitud");
    }
    for (const it of input.items) {
      if (!it.material_id && !it.descripcion?.trim()) {
        throw new Error("Todo ítem necesita material o descripción");
      }
      if (it.cantidad <= 0) throw new Error("Las cantidades deben ser mayores a 0");
    }
    const maxNum = Math.max(
      10,
      ...this.store.solicitudes.map((s) => Number(s.numero.replace("SC-", "")) || 0),
    );
    const id = `sc-${crypto.randomUUID().slice(0, 8)}`;
    const numero = `SC-${String(maxNum + 1).padStart(3, "0")}`;
    this.store.solicitudes.push({
      id,
      numero,
      tipo_material_id: input.tipo_material_id,
      proveedor_id: null,
      solicitante_id: VENDEDORES[0].id,
      estado: "pendiente",
      valor_estimado: null,
      fecha_entrega: null,
      op_id: null,
      notas: input.notas,
      activo: true,
      eliminado_en: null,
      creado_en: new Date().toISOString(),
    });
    input.items.forEach((it, n) =>
      this.store.items.push({
        id: `${id}-i${n}`,
        sc_id: id,
        material_id: it.material_id,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
      }),
    );
    return { id, numero };
  }

  async cambiarEstado(
    id: string,
    estado: SolicitudCompra["estado"],
    datos?: {
      valor_estimado?: number;
      fecha_entrega?: string;
      proveedor_id?: string | null;
    },
  ): Promise<void> {
    const sc = this.store.solicitudes.find((s) => s.id === id && s.activo);
    if (!sc) throw new Error(`Solicitud ${id} no existe`);

    const permitidas: Record<string, string[]> = {
      pendiente: ["en_cotizacion", "rechazada"],
      en_cotizacion: ["comprado", "rechazada"],
      comprado: [],
      rechazada: [],
    };
    if (!permitidas[sc.estado].includes(estado)) {
      throw new Error(`La ${sc.numero} está ${sc.estado}: no puede pasar a ${estado}`);
    }
    if (estado === "comprado") {
      if (!datos?.valor_estimado || datos.valor_estimado <= 0) {
        throw new Error("Para marcar comprada digite el valor cotizado por el proveedor");
      }
      if (!datos.fecha_entrega) {
        throw new Error("Para marcar comprada indique la fecha de entrega acordada");
      }
      sc.valor_estimado = datos.valor_estimado;
      sc.fecha_entrega = datos.fecha_entrega;
      sc.proveedor_id = datos.proveedor_id ?? sc.proveedor_id;
    }
    if (estado === "en_cotizacion" && datos?.valor_estimado) {
      sc.valor_estimado = datos.valor_estimado;
    }
    sc.estado = estado;
  }

  async registrarRecepcion(sc_id: string, items: RecepcionItemInput[]): Promise<void> {
    const sc = this.store.solicitudes.find((s) => s.id === sc_id && s.activo);
    if (!sc) throw new Error(`Solicitud ${sc_id} no existe`);
    if (sc.estado !== "comprado") {
      throw new Error(`Solo se reciben solicitudes compradas (la ${sc.numero} está ${sc.estado})`);
    }
    if (!items.some((i) => i.cant_recibida > 0 || i.cant_faltante > 0)) {
      throw new Error("Registre al menos una cantidad recibida o un faltante");
    }
    // réplica de fn_validar_recepcion: no recibir más de lo pedido
    for (const it of items) {
      const scItem = this.store.items.find((x) => x.id === it.sc_item_id);
      if (!scItem || scItem.sc_id !== sc_id) {
        throw new Error("Ítem de la solicitud no encontrado");
      }
      if (it.cant_recibida < 0 || it.cant_faltante < 0) {
        throw new Error("Cantidades negativas no permitidas");
      }
      const previa = this.store.recepcionItems
        .filter((r) => r.sc_item_id === it.sc_item_id)
        .reduce((a, r) => a + r.cant_recibida, 0);
      if (previa + it.cant_recibida > scItem.cantidad) {
        const nombre =
          MATERIALES.find((m) => m.id === scItem.material_id)?.nombre ??
          scItem.descripcion;
        throw new Error(
          `${nombre}: recibiría ${previa + it.cant_recibida} y solo se pidieron ${scItem.cantidad}`,
        );
      }
    }
    const recId = `rc-${crypto.randomUUID().slice(0, 8)}`;
    this.store.recepciones.push({
      id: recId,
      sc_id,
      usuario_id: VENDEDORES[0].id,
      fecha: new Date().toISOString(),
      cerrada: items.every((i) => i.cant_faltante === 0),
    });
    items
      .filter((i) => i.cant_recibida > 0 || i.cant_faltante > 0)
      .forEach((it, n) =>
        this.store.recepcionItems.push({
          id: `${recId}-i${n}`,
          recepcion_id: recId,
          sc_item_id: it.sc_item_id,
          cant_recibida: it.cant_recibida,
          cant_faltante: it.cant_faltante,
          nota: it.nota,
          faltante_resuelto: false,
        }),
      );
    // NOTA: en producción (compras-server) esto además inserta los
    // movimientos entrada_compra en el kardex, que suben el saldo y el costo
    // promedio. Aquí no, porque el mock de inventario es un store aparte.
  }

  async resolverFaltante(recepcion_item_id: string, nota?: string): Promise<void> {
    const ri = this.store.recepcionItems.find((r) => r.id === recepcion_item_id);
    if (!ri) throw new Error("Faltante no encontrado");
    if (ri.faltante_resuelto) throw new Error("Este faltante ya estaba resuelto");
    ri.faltante_resuelto = true;
    if (nota) ri.nota = ri.nota ? `${ri.nota} · ${nota}` : nota;
    // si la SC ya no tiene faltantes abiertos, sus recepciones cierran
    const sc_id = this.store.recepciones.find((r) => r.id === ri.recepcion_id)?.sc_id;
    if (sc_id) {
      const abiertos = this.store.recepcionItems.some((r) => {
        const rec = this.store.recepciones.find((x) => x.id === r.recepcion_id);
        return rec?.sc_id === sc_id && !r.faltante_resuelto && r.cant_faltante > 0;
      });
      if (!abiertos) {
        for (const rec of this.store.recepciones.filter((x) => x.sc_id === sc_id)) {
          rec.cerrada = true;
        }
      }
    }
  }

  async listarFaltantes(): Promise<FaltanteCard[]> {
    return this.store.recepcionItems
      .filter((r) => r.cant_faltante > 0 && !r.faltante_resuelto)
      .map((r) => {
        const rec = this.store.recepciones.find((x) => x.id === r.recepcion_id)!;
        const sc = this.store.solicitudes.find((s) => s.id === rec.sc_id)!;
        const scItem = this.store.items.find((i) => i.id === r.sc_item_id);
        return {
          recepcion_item: structuredClone(r),
          sc_id: sc.id,
          sc_numero: sc.numero,
          material_nombre:
            MATERIALES.find((m) => m.id === scItem?.material_id)?.nombre ??
            scItem?.descripcion ??
            "Ítem",
          fecha_recepcion: rec.fecha,
        };
      })
      .sort((a, b) => a.fecha_recepcion.localeCompare(b.fecha_recepcion));
  }

  async listarTiposMaterial(): Promise<TipoMaterial[]> {
    return [...TIPOS_MATERIAL];
  }

  async listarMateriales(): Promise<Material[]> {
    return MATERIALES.filter((m) => m.activo);
  }

  async listarProveedores(): Promise<Proveedor[]> {
    return PROVEEDORES.filter((p) => p.activo);
  }
}

export function getComprasRepository(): ComprasRepository {
  g.__comprasRepositorio ??= new MockComprasRepository();
  return g.__comprasRepositorio;
}
