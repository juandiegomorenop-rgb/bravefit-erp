/**
 * Repositorio REAL de Órdenes de Pedido sobre Supabase (server-only).
 *
 * Implementa `OpsRepository` leyendo/escribiendo `ordenes_pedido`, `op_items`,
 * `op_historial_etapas`, `op_despachos`, `op_observaciones`, `garantias` y los
 * lookups (etapas, orígenes, ciudades, clientes, usuarios, productos). El
 * cliente se crea por método con `createClient()` (lee la sesión → RLS aplica
 * con el JWT del usuario), así que el repositorio es stateless (singleton OK).
 *
 * Reglas que garantiza la BD (no la app):
 *   · `mp_descontada_en` SOLO la estampa `fn_descontar_bom` → al mover a una
 *     etapa que descuenta MP llamamos ese RPC (idempotente), nunca el UPDATE.
 *   · `fecha_entregada` y la regla "sin saldo no hay entrega" las aplica el
 *     trigger `trg_op_entrega`; los errores se traducen a lenguaje de negocio.
 *   · `op_despachos` exige `usuario_id = auth.uid()` (autoría no suplantable).
 *
 * Importa `@/lib/supabase/server` (→ next/headers): es server-only. NO debe
 * importarse desde componentes cliente; las piezas puras (tipos, filtros,
 * `aplicarFiltros`, constantes) siguen en `ops.ts`.
 */
import { createClient } from "@/lib/supabase/server";
import {
  aplicarFiltros,
  type DespachoDetalle,
  type FiltrosOps,
  type GarantiaCard,
  type GarantiaCrearInput,
  type GarantiaDetalle,
  type GarantiaFiltros,
  type HistorialEtapaDetalle,
  type OpCard,
  type OpCrearInput,
  type OpDetalle,
  type OpItemConProducto,
  type OpsRepository,
} from "@/lib/data/ops";
import { ordenarTarjetas } from "@/lib/ops-logic";
import type {
  Ciudad,
  Cliente,
  EtapaProduccion,
  Garantia,
  OpDespacho,
  OpHistorialEtapa,
  OpItem,
  OpObservacion,
  OrdenPedido,
  OrigenOp,
  Producto,
  Usuario,
} from "@/lib/types/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown): number =>
  typeof v === "string" ? Number(v) : (v as number);
const numN = (v: unknown): number | null =>
  v === null || v === undefined ? null : num(v);

// ---------------------------------------------------------------
// Mappers (PostgREST → tipos del dominio)
// ---------------------------------------------------------------

function toEtapa(r: any): EtapaProduccion {
  return {
    id: num(r.id),
    nombre: r.nombre,
    orden: num(r.orden),
    es_entrega: r.es_entrega,
    es_terminal: r.es_terminal,
    descuenta_mp: r.descuenta_mp,
    activo: r.activo,
  };
}
function toOrigen(r: any): OrigenOp {
  return { id: num(r.id), clave: r.clave, nombre: r.nombre, activo: r.activo };
}
function toCiudad(r: any): Ciudad {
  return { id: num(r.id), nombre: r.nombre, departamento: r.departamento };
}
function toCliente(r: any): Cliente {
  return {
    id: r.id,
    tipo: r.tipo,
    nombre: r.nombre,
    nit_cedula: r.nit_cedula ?? null,
    email: r.email ?? null,
    telefono: r.telefono ?? null,
    ciudad_id: numN(r.ciudad_id),
    direccion: r.direccion ?? null,
    canal_preferido: r.canal_preferido ?? null,
    siigo_id: r.siigo_id ?? null,
    notas: r.notas ?? null,
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
    creado_en: r.creado_en,
  };
}
function toUsuario(r: any): Usuario {
  return {
    id: r.id,
    rol_id: num(r.rol_id),
    nombre: r.nombre,
    email: r.email,
    activo: r.activo,
  };
}
function toProducto(r: any): Producto {
  return {
    id: r.id,
    sku: r.sku,
    sku_siigo: r.sku_siigo ?? null,
    shopify_product_id: r.shopify_product_id ?? null,
    nombre: r.nombre,
    descripcion: r.descripcion ?? null,
    categoria_id: num(r.categoria_id),
    clasificacion: r.clasificacion,
    origen: r.origen,
    es_rack: r.es_rack,
    unidad_id: num(r.unidad_id),
    precio_lista: num(r.precio_lista),
    costo_estandar: numN(r.costo_estandar),
    ancho_cm: numN(r.ancho_cm),
    profundidad_cm: numN(r.profundidad_cm),
    alto_cm: numN(r.alto_cm),
    peso_kg: numN(r.peso_kg),
    colores_disponibles: r.colores_disponibles ?? [],
    color_default: r.color_default ?? null,
    imagen_url: r.imagen_url ?? null,
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
    creado_en: r.creado_en,
  };
}
function toOrden(r: any): OrdenPedido {
  return {
    id: r.id,
    numero: r.numero,
    cliente_id: r.cliente_id,
    ciudad_id: numN(r.ciudad_id),
    segmento: r.segmento ?? null,
    origen_id: num(r.origen_id),
    cotizacion_id: r.cotizacion_id ?? null,
    pedido_web_id: r.pedido_web_id ?? null,
    vendedor_id: r.vendedor_id ?? null,
    etapa_id: num(r.etapa_id),
    esperando_proveedor: r.esperando_proveedor,
    requiere_instalacion: r.requiere_instalacion,
    direccion_entrega: r.direccion_entrega ?? null,
    fecha_entrega_pactada: r.fecha_entrega_pactada ?? null,
    fecha_entregada: r.fecha_entregada ?? null,
    mp_descontada_en: r.mp_descontada_en ?? null,
    notas: r.notas ?? null,
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
    creado_en: r.creado_en,
    anulada_en: r.anulada_en ?? null,
    anulada_motivo: r.anulada_motivo ?? null,
    anulada_por: r.anulada_por ?? null,
  };
}
function toItem(r: any): OpItem {
  return {
    id: r.id,
    op_id: r.op_id,
    producto_id: r.producto_id,
    cantidad: num(r.cantidad),
    cantidad_entregada: num(r.cantidad_entregada),
    precio_unit: num(r.precio_unit),
    alto_override_cm: numN(r.alto_override_cm),
    fondo_override_cm: numN(r.fondo_override_cm),
    color: r.color ?? null,
  };
}
function toObs(r: any): OpObservacion {
  return {
    id: Number(r.id),
    op_id: r.op_id,
    usuario_id: r.usuario_id ?? null,
    texto: r.texto,
    via: r.via,
    en: r.en,
  };
}
function toHist(r: any): OpHistorialEtapa {
  return {
    id: Number(r.id),
    op_id: r.op_id,
    etapa_id: num(r.etapa_id),
    usuario_id: r.usuario_id ?? null,
    nota: r.nota ?? null,
    en: r.en,
  };
}
function toDespacho(r: any): OpDespacho {
  return {
    id: Number(r.id),
    op_item_id: r.op_item_id,
    cantidad: num(r.cantidad),
    usuario_id: r.usuario_id ?? null,
    nota: r.nota ?? null,
    en: r.en,
  };
}
function toGarantia(r: any): Garantia {
  return {
    id: r.id,
    numero: r.numero,
    op_id: r.op_id,
    producto_id: r.producto_id ?? null,
    cliente_id: r.cliente_id,
    vendedor_id: r.vendedor_id ?? null,
    problema: r.problema,
    detalle: r.detalle ?? null,
    recogida: r.recogida,
    etapa_id: num(r.etapa_id),
    costo_resolucion: numN(r.costo_resolucion),
    abierta_en: r.abierta_en,
    cerrada_en: r.cerrada_en ?? null,
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
  };
}

// Índice de lookups (tablas pequeñas cacheadas por request)
interface Lookups {
  etapas: Map<number, EtapaProduccion>;
  origenes: Map<number, OrigenOp>;
  ciudades: Map<number, Ciudad>;
  clientes: Map<string, Cliente>;
  usuarios: Map<string, Usuario>;
}

class SupabaseOpsRepository implements OpsRepository {
  private async cargarLookups(): Promise<Lookups> {
    const supabase = await createClient();
    const [et, or, ci, cl, us] = await Promise.all([
      supabase.from("etapas_produccion").select("*"),
      supabase.from("origenes_op").select("*"),
      supabase.from("ciudades").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("usuarios").select("*"),
    ]);
    const firstErr = et.error || or.error || ci.error || cl.error || us.error;
    if (firstErr) throw new Error(firstErr.message);
    return {
      etapas: new Map((et.data ?? []).map((r) => [num(r.id), toEtapa(r)])),
      origenes: new Map((or.data ?? []).map((r) => [num(r.id), toOrigen(r)])),
      ciudades: new Map((ci.data ?? []).map((r) => [num(r.id), toCiudad(r)])),
      clientes: new Map((cl.data ?? []).map((r) => [r.id, toCliente(r)])),
      usuarios: new Map((us.data ?? []).map((r) => [r.id, toUsuario(r)])),
    };
  }

  private itemsConProducto(rows: any[]): OpItemConProducto[] {
    return (rows ?? []).map((r) => ({
      ...toItem(r),
      producto: toProducto(r.productos),
    }));
  }

  private cardDeOp(op: any, lk: Lookups): OpCard {
    return {
      id: op.id,
      tipo: "op",
      numero: op.numero,
      op_id: op.id,
      etapa_id: num(op.etapa_id),
      cliente: lk.clientes.get(op.cliente_id)!,
      ciudad: op.ciudad_id != null ? (lk.ciudades.get(num(op.ciudad_id)) ?? null) : null,
      origen: lk.origenes.get(num(op.origen_id))!,
      vendedor: op.vendedor_id ? (lk.usuarios.get(op.vendedor_id) ?? null) : null,
      segmento: op.segmento ?? null,
      requiere_instalacion: op.requiere_instalacion,
      esperando_proveedor: op.esperando_proveedor,
      fecha_creacion: op.creado_en,
      fecha_entrega_pactada: op.fecha_entrega_pactada ?? null,
      fecha_entregada: op.fecha_entregada ?? null,
      items: this.itemsConProducto(op.op_items),
      garantia: null,
      anulada: !!op.anulada_en,
    };
  }

  private cardDeGarantia(g: any, op: any, lk: Lookups, prod: Producto | null): OpCard {
    return {
      id: g.id,
      tipo: "garantia",
      numero: g.numero,
      op_id: g.op_id,
      etapa_id: num(g.etapa_id),
      cliente: lk.clientes.get(g.cliente_id)!,
      ciudad: op && op.ciudad_id != null ? (lk.ciudades.get(num(op.ciudad_id)) ?? null) : null,
      origen: op ? lk.origenes.get(num(op.origen_id))! : lk.origenes.values().next().value!,
      vendedor: g.vendedor_id ? (lk.usuarios.get(g.vendedor_id) ?? null) : null,
      segmento: op?.segmento ?? null,
      requiere_instalacion: false,
      esperando_proveedor: false,
      fecha_creacion: g.abierta_en,
      fecha_entrega_pactada: null,
      fecha_entregada: g.cerrada_en ?? null,
      items: prod
        ? [
            {
              id: `gi-${g.id}`,
              op_id: g.op_id,
              producto_id: prod.id,
              cantidad: 1,
              cantidad_entregada: 0,
              precio_unit: 0,
              alto_override_cm: null,
              fondo_override_cm: null,
              color: null,
              producto: prod,
            },
          ]
        : [],
      garantia: toGarantia(g),
    };
  }

  async listarOps(filtros: FiltrosOps = {}): Promise<OpCard[]> {
    const supabase = await createClient();
    const lk = await this.cargarLookups();

    // Activas + anuladas: las anuladas viajan con anulada=true y el
    // filtro de archivo (esOpArchivada) las saca del tablero por defecto.
    const { data: ops, error } = await supabase
      .from("ordenes_pedido")
      .select("*, op_items(*, productos(*))")
      .or("activo.is.true,anulada_en.not.is.null");
    if (error) throw new Error(error.message);

    // garantías abiertas (comparten el tablero con prioridad ambulancia)
    const { data: gars, error: gErr } = await supabase
      .from("garantias")
      .select("*")
      .eq("activo", true)
      .is("cerrada_en", null);
    if (gErr) throw new Error(gErr.message);

    const opsById = new Map((ops ?? []).map((o) => [o.id, o]));
    const prodIds = [...new Set((gars ?? []).map((g) => g.producto_id).filter(Boolean))];
    const prodMap = new Map<string, Producto>();
    if (prodIds.length) {
      const { data: prods } = await supabase
        .from("productos")
        .select("*")
        .in("id", prodIds as string[]);
      (prods ?? []).forEach((p) => prodMap.set(p.id, toProducto(p)));
    }

    const cards: OpCard[] = [
      ...(ops ?? []).map((o) => this.cardDeOp(o, lk)),
      ...(gars ?? []).map((g) =>
        this.cardDeGarantia(
          g,
          opsById.get(g.op_id),
          lk,
          g.producto_id ? (prodMap.get(g.producto_id) ?? null) : null,
        ),
      ),
    ];
    return ordenarTarjetas(aplicarFiltros(cards, filtros));
  }

  async obtenerOp(id: string): Promise<OpDetalle | null> {
    const supabase = await createClient();
    const lk = await this.cargarLookups();

    // el id puede ser de una garantía → resolver a su OP
    const { data: gar } = await supabase
      .from("garantias")
      .select("op_id")
      .eq("id", id)
      .maybeSingle();
    const opId = gar?.op_id ?? id;

    // Sin filtro de activo: las OP anuladas siguen siendo consultables
    // (el detalle muestra el banner de anulación).
    const { data: op, error } = await supabase
      .from("ordenes_pedido")
      .select("*, op_items(*, productos(*))")
      .eq("id", opId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!op) return null;

    const items = this.itemsConProducto(op.op_items);
    const itemIds = items.map((i) => i.id);

    const [hist, desp, obs, gars] = await Promise.all([
      supabase.from("op_historial_etapas").select("*").eq("op_id", opId).order("en", { ascending: true }),
      itemIds.length
        ? supabase.from("op_despachos").select("*").in("op_item_id", itemIds).order("en", { ascending: false })
        : Promise.resolve({ data: [], error: null } as any),
      supabase.from("op_observaciones").select("*").eq("op_id", opId).order("en", { ascending: false }),
      supabase.from("garantias").select("*").eq("op_id", opId).eq("activo", true),
    ]);

    const historial: HistorialEtapaDetalle[] = (hist.data ?? []).map((h: any) => ({
      ...toHist(h),
      etapa: lk.etapas.get(num(h.etapa_id))!,
    }));
    const despachos: DespachoDetalle[] = (desp.data ?? []).map((d: any) => ({
      ...toDespacho(d),
      item: items.find((i) => i.id === d.op_item_id)!,
    }));

    return {
      op: toOrden(op),
      cliente: lk.clientes.get(op.cliente_id)!,
      ciudad: op.ciudad_id != null ? (lk.ciudades.get(num(op.ciudad_id)) ?? null) : null,
      origen: lk.origenes.get(num(op.origen_id))!,
      vendedor: op.vendedor_id ? (lk.usuarios.get(op.vendedor_id) ?? null) : null,
      etapa: lk.etapas.get(num(op.etapa_id))!,
      items,
      historial,
      despachos,
      observaciones: (obs.data ?? []).map(toObs),
      garantias: (gars.data ?? []).map(toGarantia),
    };
  }

  async anularOp(op_id: string, motivo: string): Promise<void> {
    if (!motivo.trim()) throw new Error("El motivo de anulación es obligatorio");
    const supabase = await createClient();
    const { error } = await supabase.rpc("fn_anular_op", {
      p_op_id: op_id,
      p_motivo: motivo.trim(),
    });
    if (error) {
      // Si la función no existe aún, guiar al SQL pendiente
      if (/fn_anular_op/.test(error.message) && /not exist|no existe/i.test(error.message)) {
        throw new Error(
          "Falta correr el SQL 2026-07-20_anular_op.sql en Supabase (crea fn_anular_op).",
        );
      }
      throw new Error(error.message);
    }
  }

  async moverEtapa(cardId: string, etapa_id: number, nota?: string): Promise<void> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: etapa, error: etErr } = await supabase
      .from("etapas_produccion")
      .select("*")
      .eq("id", etapa_id)
      .single();
    if (etErr) throw new Error(etErr.message);

    // ¿es una garantía?
    const { data: gar } = await supabase
      .from("garantias")
      .select("id")
      .eq("id", cardId)
      .maybeSingle();
    if (gar) {
      const patch: Record<string, unknown> = { etapa_id };
      if (etapa.es_entrega || etapa.es_terminal) {
        patch.cerrada_en = new Date().toISOString();
      }
      const { error } = await supabase.from("garantias").update(patch).eq("id", cardId);
      if (error) throw new Error(error.message);
      return;
    }

    // OP: el trigger trg_op_entrega valida entrega/saldo; mp la estampa el RPC
    const { error } = await supabase
      .from("ordenes_pedido")
      .update({ etapa_id })
      .eq("id", cardId);
    if (error) {
      if (/saldo pendiente/i.test(error.message)) {
        throw new Error(
          "No se puede marcar entregada: la OP tiene saldo pendiente. Registra el pago primero.",
        );
      }
      if (/sin despachar/i.test(error.message)) {
        throw new Error(
          "No se puede marcar entregada: hay ítems sin despachar al 100%.",
        );
      }
      throw new Error(error.message);
    }

    if (etapa.descuenta_mp) {
      const { error: bomErr } = await supabase.rpc("fn_descontar_bom", { p_op_id: cardId });
      if (bomErr && !/existencia registrada/i.test(bomErr.message)) {
        // el descuento es idempotente; un faltante de existencia se reporta claro
        throw new Error(bomErr.message);
      }
    }

    const { error: hErr } = await supabase.from("op_historial_etapas").insert({
      op_id: cardId,
      etapa_id,
      usuario_id: user?.id ?? null,
      nota: nota ?? null,
    });
    if (hErr) throw new Error(hErr.message);
  }

  async registrarDespacho(op_item_id: string, cantidad: number, nota?: string): Promise<void> {
    if (!(cantidad > 0)) throw new Error("La cantidad a despachar debe ser mayor que cero.");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión no válida: vuelve a iniciar sesión.");
    const { error } = await supabase.from("op_despachos").insert({
      op_item_id,
      cantidad,
      usuario_id: user.id,
      nota: nota ?? null,
    });
    if (error) {
      if (/exceeds|mayor|cantidad/i.test(error.message)) {
        throw new Error("La cantidad despachada supera lo pendiente del ítem.");
      }
      throw new Error(error.message);
    }
  }

  async agregarObservacion(op_id: string, texto: string): Promise<OpObservacion> {
    const limpio = texto.trim();
    if (!limpio) throw new Error("La observación no puede estar vacía.");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("op_observaciones")
      .insert({ op_id, texto: limpio, via: "app", usuario_id: user?.id ?? null })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return toObs(data);
  }

  async crearOp(input: OpCrearInput): Promise<OrdenPedido> {
    if (input.items.length === 0) throw new Error("Una OP no puede crearse sin ítems");
    const supabase = await createClient();

    const { data: origen, error: oErr } = await supabase
      .from("origenes_op")
      .select("id, clave")
      .eq("clave", input.origen_clave)
      .single();
    if (oErr) throw new Error(`Origen '${input.origen_clave}' no existe`);

    const { data: cola, error: cErr } = await supabase
      .from("etapas_produccion")
      .select("id")
      .eq("orden", 1)
      .single();
    if (cErr) throw new Error(cErr.message);

    // Numeración global OP_<ABBR>_#### — la sigla dice DE DÓNDE VINO EL
    // PEDIDO (WhatsApp, planner, showroom, Shopify). Si la OP nace de una
    // cotización ganada, hereda el origen de ESA cotización: "COT" no es
    // un origen (toda OP nace de una venta) y perdía el rastro del lead.
    const ABBR: Record<string, string> = {
      whatsapp: "WA",
      planner: "BFP",
      shopify: "SPFY",
      showroom: "SR",
      chat: "CHAT",
      manual: "MAN",
    };
    let claveOrigen = input.origen_clave;
    if (input.cotizacion_id) {
      const { data: cot } = await supabase
        .from("cotizaciones")
        .select("origen")
        .eq("id", input.cotizacion_id)
        .maybeSingle();
      if (cot?.origen) claveOrigen = cot.origen;
    }
    const abbr = ABBR[claveOrigen] ?? claveOrigen.slice(0, 3).toUpperCase();
    // Consecutivo ATÓMICO desde la tabla `secuencias` (antes se contaban
    // las OPs: dos altas simultáneas producían el mismo número).
    const { data: numRaw, error: nErr } = await supabase.rpc(
      "fn_siguiente_numero",
      { p_clave: "op" },
    );
    if (nErr) throw new Error(nErr.message);
    const digitos = String(numRaw).replace(/\D/g, "").padStart(4, "0");
    const numero = `OP_${abbr}_${digitos}`;

    // comercializados puros → entran a Cola esperando proveedor
    const prodIds = input.items.map((i) => i.producto_id);
    const { data: prods } = await supabase
      .from("productos")
      .select("id, origen")
      .in("id", prodIds);
    const soloComerc =
      (prods ?? []).length > 0 &&
      (prods ?? []).every((p) => p.origen === "comercializado");

    const { data: cli } = await supabase
      .from("clientes")
      .select("direccion")
      .eq("id", input.cliente_id)
      .maybeSingle();

    const { data: op, error } = await supabase
      .from("ordenes_pedido")
      .insert({
        numero,
        cliente_id: input.cliente_id,
        ciudad_id: input.ciudad_id,
        segmento: input.segmento,
        origen_id: origen.id,
        cotizacion_id: input.cotizacion_id,
        vendedor_id: input.vendedor_id ?? null,
        etapa_id: cola.id,
        esperando_proveedor: soloComerc,
        requiere_instalacion: input.requiere_instalacion ?? false,
        direccion_entrega: cli?.direccion ?? null,
        notas: input.notas ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const filas = input.items.map((it) => ({
      op_id: op.id,
      producto_id: it.producto_id,
      cantidad: it.cantidad,
      precio_unit: it.precio_unit,
      alto_override_cm: it.alto_override_cm ?? null,
      fondo_override_cm: it.fondo_override_cm ?? null,
      color: it.color ?? null,
    }));
    const { error: itErr } = await supabase.from("op_items").insert(filas);
    if (itErr) throw new Error(itErr.message);

    await supabase.from("op_historial_etapas").insert({
      op_id: op.id,
      etapa_id: cola.id,
      nota: input.notas ?? "OP creada",
    });
    return toOrden(op);
  }

  // ---- Garantías -------------------------------------------------
  private async garantiaCard(g: any, lk: Lookups): Promise<GarantiaCard> {
    const supabase = await createClient();
    const { data: op } = await supabase
      .from("ordenes_pedido")
      .select("numero")
      .eq("id", g.op_id)
      .maybeSingle();
    let producto: Producto | null = null;
    if (g.producto_id) {
      const { data: p } = await supabase
        .from("productos")
        .select("*")
        .eq("id", g.producto_id)
        .maybeSingle();
      producto = p ? toProducto(p) : null;
    }
    const fin = g.cerrada_en ? new Date(g.cerrada_en) : new Date();
    return {
      garantia: toGarantia(g),
      cliente: lk.clientes.get(g.cliente_id)!,
      producto,
      vendedor: g.vendedor_id ? (lk.usuarios.get(g.vendedor_id) ?? null) : null,
      op_numero: op?.numero ?? "—",
      etapa: lk.etapas.get(num(g.etapa_id))!,
      dias: Math.max(
        0,
        Math.floor((fin.getTime() - new Date(g.abierta_en).getTime()) / 86_400_000),
      ),
    };
  }

  async listarGarantias(filtros: GarantiaFiltros = {}): Promise<GarantiaCard[]> {
    const supabase = await createClient();
    const lk = await this.cargarLookups();
    let q = supabase.from("garantias").select("*").eq("activo", true);
    if (filtros.estado === "abiertas") q = q.is("cerrada_en", null);
    else if (filtros.estado === "cerradas") q = q.not("cerrada_en", "is", null);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const cards = await Promise.all((data ?? []).map((g) => this.garantiaCard(g, lk)));
    const term = filtros.texto?.trim().toLowerCase();
    return cards
      .filter((c) => {
        if (!term) return true;
        const blob = [
          c.garantia.numero,
          c.cliente?.nombre ?? "",
          c.producto?.nombre ?? "",
          c.garantia.problema,
          c.op_numero,
          c.vendedor?.nombre ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(term);
      })
      .sort((a, b) => {
        const av = a.garantia.cerrada_en ? 1 : 0;
        const bv = b.garantia.cerrada_en ? 1 : 0;
        if (av !== bv) return av - bv;
        return b.garantia.abierta_en.localeCompare(a.garantia.abierta_en);
      });
  }

  async obtenerGarantia(id: string): Promise<GarantiaDetalle | null> {
    const supabase = await createClient();
    const lk = await this.cargarLookups();
    const { data: g, error } = await supabase
      .from("garantias")
      .select("*")
      .eq("id", id)
      .eq("activo", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!g) return null;
    const card = await this.garantiaCard(g, lk);
    const { data: op } = await supabase
      .from("ordenes_pedido")
      .select("*")
      .eq("id", g.op_id)
      .maybeSingle();

    // multi-ítem: todos los productos cubiertos (fallback = principal)
    let productos: Producto[] = card.producto ? [card.producto] : [];
    const { data: gps, error: gpErr } = await supabase
      .from("garantia_productos")
      .select("productos(*)")
      .eq("garantia_id", g.id);
    if (!gpErr && gps && gps.length) {
      productos = (gps as any[]).map((r) => toProducto(r.productos));
    }

    return {
      ...card,
      op: toOrden(op),
      ciudad: op?.ciudad_id != null ? (lk.ciudades.get(num(op.ciudad_id)) ?? null) : null,
      productos,
    };
  }

  async crearGarantia(input: GarantiaCrearInput): Promise<Garantia> {
    if (!input.problema.trim()) throw new Error("Describa la falla reportada");
    const supabase = await createClient();

    const { data: op, error: opErr } = await supabase
      .from("ordenes_pedido")
      .select("cliente_id")
      .eq("id", input.op_id)
      .eq("activo", true)
      .maybeSingle();
    if (opErr) throw new Error(opErr.message);
    if (!op) throw new Error("Seleccione la OP de origen de la garantía");

    const { data: cola, error: cErr } = await supabase
      .from("etapas_produccion")
      .select("id")
      .eq("orden", 1)
      .single();
    if (cErr) throw new Error(cErr.message);

    // siguiente GR-#### (global)
    const { count } = await supabase
      .from("garantias")
      .select("id", { count: "exact", head: true });
    const numero = `GR-${String((count ?? 0) + 1).padStart(4, "0")}`;

    // producto principal = primero seleccionado (compatibilidad kanban/listas)
    const ids = [...new Set(input.producto_ids ?? [])];
    const principal = input.producto_id ?? ids[0] ?? null;

    const { data, error } = await supabase
      .from("garantias")
      .insert({
        numero,
        op_id: input.op_id,
        producto_id: principal,
        cliente_id: op.cliente_id,
        vendedor_id: input.vendedor_id,
        problema: input.problema.trim(),
        detalle: input.detalle,
        recogida: input.recogida,
        etapa_id: cola.id,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // detalle multi-ítem (tabla garantia_productos); si aún no existe la
    // tabla, la garantía queda creada con su producto principal igual.
    if (ids.length) {
      const { error: gpErr } = await supabase.from("garantia_productos").insert(
        ids.map((pid) => ({ garantia_id: data.id, producto_id: pid })),
      );
      if (gpErr) console.warn("garantia_productos:", gpErr.message);
    }
    return toGarantia(data);
  }

  async actualizarGarantia(
    id: string,
    patch: Partial<Pick<Garantia, "recogida" | "costo_resolucion" | "detalle" | "vendedor_id">>,
  ): Promise<void> {
    if (patch.costo_resolucion != null && patch.costo_resolucion < 0) {
      throw new Error("El costo no puede ser negativo");
    }
    const supabase = await createClient();
    const { error } = await supabase.from("garantias").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listarEtapas(): Promise<EtapaProduccion[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("etapas_produccion")
      .select("*")
      .order("orden", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toEtapa);
  }

  async listarOrigenes(): Promise<OrigenOp[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("origenes_op").select("*").order("id");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toOrigen);
  }

  async listarCiudades(): Promise<Ciudad[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ciudades")
      .select("*")
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toCiudad);
  }
}

// ---------------------------------------------------------------
// Despiece (BOM) por producto — para la vista imprimible de taller.
// Devuelve solo componentes con material rastreado (platinas / impresión 3D);
// la tornillería/tubería se sumará cuando se cargue ese BOM.
// ---------------------------------------------------------------

export interface ComponenteBom {
  producto_id: string;
  categoria: string;
  descripcion: string;
  cantidad: number;
  material_nombre: string | null;
}

export async function bomDeProductos(
  ids: string[],
): Promise<Map<string, ComponenteBom[]>> {
  const map = new Map<string, ComponenteBom[]>();
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("producto_componentes")
    .select("producto_id, categoria, descripcion, cantidad, materiales(nombre)")
    .in("producto_id", unicos)
    .not("material_id", "is", null);
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as any[]) {
    const arr = map.get(r.producto_id) ?? [];
    arr.push({
      producto_id: r.producto_id,
      categoria: r.categoria,
      descripcion: r.descripcion,
      cantidad: num(r.cantidad),
      material_nombre: r.materiales?.nombre ?? null,
    });
    map.set(r.producto_id, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));
  }
  return map;
}

/**
 * Documentos de referencia de una OP: cotización (siempre debería existir,
 * salvo Shopify), factura (o "sin factura" si la cotización es no_facturar)
 * y pedido Shopify. Alimenta la tarjeta Documentos y el Formato Imprimible.
 */
export interface DocumentosOp {
  cotizacion: { id: string; numero: string } | null;
  sinFactura: boolean; // cotización marcada no_facturar → FRA: N/A
  factura: { id: string; numero: string | null } | null;
  pedidoWeb: { id: string; numero: string | null } | null;
}

export async function documentosDeOp(op: {
  id: string;
  cotizacion_id: string | null;
  pedido_web_id: string | null;
}): Promise<DocumentosOp> {
  const supabase = await createClient();
  const out: DocumentosOp = {
    cotizacion: null,
    sinFactura: false,
    factura: null,
    pedidoWeb: null,
  };
  const [cot, fac, pw] = await Promise.all([
    op.cotizacion_id
      ? supabase
          .from("cotizaciones")
          .select("id, numero, no_facturar")
          .eq("id", op.cotizacion_id)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase
      .from("facturas")
      .select("id, numero")
      .or(
        op.cotizacion_id
          ? `op_id.eq.${op.id},cotizacion_id.eq.${op.cotizacion_id}`
          : `op_id.eq.${op.id}`,
      )
      .limit(1)
      .maybeSingle(),
    op.pedido_web_id
      ? supabase
          .from("pedidos_web")
          .select("id, shopify_numero")
          .eq("id", op.pedido_web_id)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);
  if (cot.data) {
    out.cotizacion = { id: cot.data.id, numero: cot.data.numero };
    out.sinFactura = !!cot.data.no_facturar;
  }
  if (fac.data) out.factura = { id: fac.data.id, numero: fac.data.numero ?? null };
  if (pw.data) out.pedidoWeb = { id: pw.data.id, numero: pw.data.shopify_numero ?? null };
  return out;
}

/**
 * Reversa (elimina) un despacho registrado por error. Los despachos son
 * inmutables, pero la RLS permite DELETE solo a quien tenga
 * produccion.aprobar (Admin); el trigger revierte cantidad_entregada.
 */
// ---------------------------------------------------------------
// Pagos de la OP (regla de Juan: sin saldo en cero NO hay entrega;
// la RLS de `pagos` solo deja escribir a roles con Ventas = Admins)
// ---------------------------------------------------------------

export interface PagoOp {
  id: string;
  concepto: "anticipo" | "saldo" | "abono" | "total";
  monto: number;
  medio: string | null;
  recibido_en: string; // 'YYYY-MM-DD'
  nota: string | null;
}

/** Pagos que cuentan para el saldo de la OP: los suyos directos + los
 *  de su cotización (misma lógica que v_op_saldo y el trigger). */
export async function pagosDeOp(
  opId: string,
  cotizacionId: string | null,
): Promise<PagoOp[]> {
  const supabase = await createClient();
  let q = supabase.from("pagos").select("*");
  q = cotizacionId
    ? q.or(`op_id.eq.${opId},cotizacion_id.eq.${cotizacionId}`)
    : q.eq("op_id", opId);
  const { data, error } = await q.order("recibido_en", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p: any) => ({
    id: p.id,
    concepto: p.concepto,
    monto: num(p.monto),
    medio: p.medio ?? null,
    recibido_en: p.recibido_en,
    nota: p.nota ?? null,
  }));
}

export async function registrarPago(
  opId: string,
  input: {
    monto: number;
    concepto: PagoOp["concepto"];
    medio: string | null;
    nota: string | null;
  },
): Promise<void> {
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    throw new Error("El monto del pago debe ser mayor a 0");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("pagos").insert({
    op_id: opId,
    concepto: input.concepto,
    monto: input.monto,
    medio: input.medio,
    nota: input.nota,
    usuario_id: user?.id ?? null,
    fuente: "manual",
  });
  if (error) {
    if (/policy|row-level|permission/i.test(error.message)) {
      throw new Error("Solo un Administrador puede registrar pagos.");
    }
    throw new Error(error.message);
  }
}

export async function eliminarDespacho(despachoId: number): Promise<void> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("op_despachos")
    .delete({ count: "exact" })
    .eq("id", despachoId);
  if (error) throw new Error(error.message);
  if (!count) {
    throw new Error(
      "No se pudo reversar: solo un Administrador puede deshacer despachos.",
    );
  }
}

/** Paleta estándar de colores (tabla `colores`) — chips pintados en el
 *  formato imprimible, como en el PDF del planner. */
export async function listarColores(): Promise<{ nombre: string; hex: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("colores").select("nombre, hex");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c: any) => ({ nombre: c.nombre, hex: c.hex }));
}

// ---------------------------------------------------------------
// Factory server-only. Stateless (cliente por request) → singleton OK.
// ---------------------------------------------------------------
const globalRepo = globalThis as unknown as {
  __opsRepositorioServer?: OpsRepository;
};

export function getOpsRepository(): OpsRepository {
  globalRepo.__opsRepositorioServer ??= new SupabaseOpsRepository();
  return globalRepo.__opsRepositorioServer;
}
