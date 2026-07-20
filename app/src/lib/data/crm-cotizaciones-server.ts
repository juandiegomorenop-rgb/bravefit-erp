/**
 * Repositorios REALES de Cotizaciones y CRM sobre Supabase (server-only).
 *
 * Implementan `CotizacionesRepository` y `CrmRepository` (interfaces en
 * crm-cotizaciones.ts, que sigue siendo client-safe con tipos y mock).
 *
 * Reglas de negocio que respeta:
 *   · numeración BFP-NNNN vía fn_siguiente_numero('cotizacion') — el
 *     consecutivo vive en la tabla `secuencias`, no en la app.
 *   · nace en Borrador con valida_hasta = creación + 15 días.
 *   · solo Borradores se editan/envían (regla del mock replicada).
 *   · Ganar en CRM: el trigger fn_validar_ganada exige cotización con
 *     ítems; la OP la crea la app (crearOp real, origen 'cotizacion',
 *     precio con descuento de línea aplicado) y la cotización pasa a
 *     Aprobada. trg_oportunidad_movida estampa movida_en solo.
 */
import { createClient } from "@/lib/supabase/server";
import {
  calcularTotales,
  estaVencida,
  type CotizacionItemConProducto,
} from "@/lib/cotizacion-logic";
import type {
  CotizacionCard,
  CotizacionDetalle,
  CotizacionInput,
  CotizacionesRepository,
  CrmRepository,
  FiltrosCotizaciones,
  FiltrosCrm,
  OportunidadCard,
  OportunidadNuevaInput,
  ResultadoMoverCrm,
} from "@/lib/data/crm-cotizaciones";
import { getOpsRepository } from "@/lib/data/ops-server";
import type {
  Ciudad,
  Cliente,
  Cotizacion,
  CotizacionItem,
  EstadoCotizacion,
  EtapaCrm,
  Oportunidad,
  Producto,
  ProductoDimension,
  Usuario,
} from "@/lib/types/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown): number =>
  typeof v === "string" ? Number(v) : (v as number);
const numN = (v: unknown): number | null =>
  v === null || v === undefined ? null : num(v);

// ---------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------

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
function toCiudad(r: any): Ciudad {
  return { id: num(r.id), nombre: r.nombre, departamento: r.departamento };
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
function toCotizacion(r: any): Cotizacion {
  return {
    id: r.id,
    numero: r.numero,
    cliente_id: r.cliente_id,
    vendedor_id: r.vendedor_id,
    segmento: r.segmento,
    estado_id: num(r.estado_id),
    no_facturar: r.no_facturar,
    descuento_pct: num(r.descuento_pct),
    pago_anticipado_completo: r.pago_anticipado_completo,
    valida_hasta: r.valida_hasta,
    tiempo_entrega: r.tiempo_entrega ?? null,
    origen: r.origen,
    notas: r.notas ?? null,
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
    creado_en: r.creado_en,
  };
}
function toItem(r: any): CotizacionItem {
  return {
    id: r.id,
    cotizacion_id: r.cotizacion_id,
    producto_id: r.producto_id ?? null,
    descripcion: r.descripcion ?? null,
    es_transporte: r.es_transporte,
    aplica_iva: r.aplica_iva,
    cantidad: num(r.cantidad),
    precio_unit: num(r.precio_unit),
    descuento_pct: num(r.descuento_pct),
    alto_override_cm: numN(r.alto_override_cm),
    fondo_override_cm: numN(r.fondo_override_cm),
    color: r.color ?? null,
    recargos: r.recargos ?? [],
  };
}
/** Ordena filas crudas de cotizacion_items por su orden manual (drag & drop). */
function ordenarItems<T extends { orden?: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}
function toEstado(r: any): EstadoCotizacion {
  return {
    id: num(r.id),
    nombre: r.nombre,
    orden: num(r.orden),
    activo: r.activo,
  };
}
function toEtapaCrm(r: any): EtapaCrm {
  return {
    id: num(r.id),
    nombre: r.nombre,
    orden: num(r.orden),
    color: r.color ?? null,
    es_ganada: r.es_ganada,
    es_perdida: r.es_perdida,
    activo: r.activo,
  };
}
function toOportunidad(r: any): Oportunidad {
  return {
    id: r.id,
    cliente_id: r.cliente_id,
    cotizacion_id: r.cotizacion_id ?? null,
    etapa_id: num(r.etapa_id),
    vendedor_id: r.vendedor_id,
    valor_estimado: numN(r.valor_estimado),
    notas: r.notas ?? null,
    movida_en: r.movida_en,
    activo: r.activo,
    eliminado_en: r.eliminado_en ?? null,
    creado_en: r.creado_en,
  };
}

function validarInput(input: CotizacionInput): void {
  if (!input.cliente_id) throw new Error("Seleccione el cliente");
  if (!input.vendedor_id) throw new Error("Seleccione el vendedor");
  if (input.segmento !== "B2B" && input.segmento !== "B2C") {
    throw new Error("El segmento B2B/B2C es obligatorio");
  }
  if (input.descuento_pct < 0 || input.descuento_pct > 50) {
    throw new Error("El descuento global va de 0 a 50%");
  }
  for (const it of input.items) {
    if (!it.producto_id && !it.descripcion?.trim()) {
      throw new Error("Todo ítem libre necesita descripción");
    }
    if (it.cantidad <= 0)
      throw new Error("Las cantidades deben ser mayores a 0");
    if (it.precio_unit < 0)
      throw new Error("Los precios no pueden ser negativos");
    if (it.descuento_pct < 0 || it.descuento_pct > 100) {
      throw new Error("El descuento por línea va de 0 a 100%");
    }
  }
}

// ---------------------------------------------------------------
// Cotizaciones
// ---------------------------------------------------------------

class SupabaseCotizacionesRepository implements CotizacionesRepository {
  private async itemsDe(
    cotIds: string[],
  ): Promise<Map<string, CotizacionItemConProducto[]>> {
    const map = new Map<string, CotizacionItemConProducto[]>();
    if (!cotIds.length) return map;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cotizacion_items")
      .select("*, productos(*)")
      .in("cotizacion_id", cotIds);
    if (error) throw new Error(error.message);
    for (const r of ordenarItems((data ?? []) as any[])) {
      const arr = map.get(r.cotizacion_id) ?? [];
      arr.push({
        ...toItem(r),
        producto: r.productos ? toProducto(r.productos) : null,
      });
      map.set(r.cotizacion_id, arr);
    }
    return map;
  }

  async listar(filtros: FiltrosCotizaciones = {}): Promise<CotizacionCard[]> {
    const supabase = await createClient();
    const [
      { data: cots, error },
      { data: clientes },
      { data: usuarios },
      estados,
    ] = await Promise.all([
      supabase
        .from("cotizaciones")
        .select("*")
        .eq("activo", true)
        .order("creado_en", { ascending: false }),
      supabase.from("clientes").select("*"),
      supabase.from("usuarios").select("*"),
      this.listarEstados(),
    ]);
    if (error) throw new Error(error.message);

    const cliMap = new Map((clientes ?? []).map((c) => [c.id, toCliente(c)]));
    const usrMap = new Map((usuarios ?? []).map((u) => [u.id, toUsuario(u)]));
    const estMap = new Map(estados.map((e) => [e.id, e]));
    const items = await this.itemsDe((cots ?? []).map((c) => c.id));

    const q = filtros.texto?.trim().toLowerCase();
    return (cots ?? [])
      .map((r) => {
        const cot = toCotizacion(r);
        const estado = estMap.get(cot.estado_id)!;
        const its = items.get(cot.id) ?? [];
        return {
          cotizacion: cot,
          cliente: cliMap.get(cot.cliente_id)!,
          vendedor: usrMap.get(cot.vendedor_id)!,
          estado,
          total: calcularTotales(its, cot).total,
          vencida: estaVencida(cot, estado.nombre),
        } satisfies CotizacionCard;
      })
      .filter((c) => {
        if (
          filtros.estado_id !== undefined &&
          c.estado.id !== filtros.estado_id
        )
          return false;
        if (filtros.vendedor_id && c.vendedor.id !== filtros.vendedor_id)
          return false;
        if (filtros.segmento && c.cotizacion.segmento !== filtros.segmento)
          return false;
        if (q) {
          const blob = [c.cotizacion.numero, c.cliente.nombre]
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      });
  }

  async obtener(id: string): Promise<CotizacionDetalle | null> {
    const supabase = await createClient();
    const { data: r, error } = await supabase
      .from("cotizaciones")
      .select("*")
      .eq("id", id)
      .eq("activo", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return null;
    const cot = toCotizacion(r);

    const [{ data: cli }, { data: vend }, estados, itemsMap, { data: opo }] =
      await Promise.all([
        supabase.from("clientes").select("*").eq("id", cot.cliente_id).single(),
        supabase
          .from("usuarios")
          .select("*")
          .eq("id", cot.vendedor_id)
          .single(),
        this.listarEstados(),
        this.itemsDe([cot.id]),
        supabase
          .from("oportunidades")
          .select("id")
          .eq("cotizacion_id", cot.id)
          .maybeSingle(),
      ]);
    const cliente = toCliente(cli);
    let ciudad: Ciudad | null = null;
    if (cliente.ciudad_id != null) {
      const { data: ciu } = await supabase
        .from("ciudades")
        .select("*")
        .eq("id", cliente.ciudad_id)
        .maybeSingle();
      ciudad = ciu ? toCiudad(ciu) : null;
    }
    const estado = estados.find((e) => e.id === cot.estado_id)!;
    const items = itemsMap.get(cot.id) ?? [];
    return {
      cotizacion: cot,
      cliente,
      ciudad,
      vendedor: toUsuario(vend),
      estado,
      items,
      totales: calcularTotales(items, cot),
      vencida: estaVencida(cot, estado.nombre),
      oportunidad_id: opo?.id ?? null,
    };
  }

  private async estadoPorNombre(nombre: string): Promise<EstadoCotizacion> {
    const estados = await this.listarEstados();
    const e = estados.find((x) => x.nombre === nombre);
    if (!e) throw new Error(`Estado '${nombre}' no existe`);
    return e;
  }

  private async insertarItems(
    cotizacionId: string,
    items: CotizacionInput["items"],
  ): Promise<void> {
    if (!items.length) return;
    const supabase = await createClient();
    // El orden del array ES el orden manual (drag & drop del editor).
    const filas = items.map((it, idx) => ({
      cotizacion_id: cotizacionId,
      producto_id: it.producto_id,
      descripcion: it.descripcion,
      es_transporte: it.es_transporte,
      aplica_iva: it.aplica_iva,
      cantidad: it.cantidad,
      precio_unit: it.precio_unit,
      descuento_pct: it.descuento_pct,
      alto_override_cm: it.alto_override_cm,
      fondo_override_cm: it.fondo_override_cm,
      color: it.color,
      recargos: it.recargos ?? [],
      orden: idx,
    }));
    const { error } = await supabase.from("cotizacion_items").insert(filas);
    if (error) {
      // Si la columna `orden` aún no existe (falta correr el SQL
      // 2026-07-19_cotizacion_items_orden.sql), guardar sin ella.
      if (/orden/.test(error.message)) {
        console.warn(
          "cotizacion_items.orden no existe aún — guardando sin orden manual:",
          error.message,
        );
        const { error: e2 } = await supabase
          .from("cotizacion_items")
          .insert(filas.map(({ orden, ...f }) => f));
        if (e2) throw new Error(e2.message);
        return;
      }
      throw new Error(error.message);
    }
  }

  async anular(id: string): Promise<void> {
    const supabase = await createClient();
    const { data: r, error } = await supabase
      .from("cotizaciones")
      .select("*")
      .eq("id", id)
      .eq("activo", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error("La cotización no existe");
    const cot = toCotizacion(r);
    const estados = await this.listarEstados();
    const estado = estados.find((e) => e.id === cot.estado_id)!;
    if (estado.nombre === "Aprobada") {
      throw new Error(
        `La ${cot.numero} está Aprobada y ya generó OP — no se puede anular. Gestione la OP en Producción.`,
      );
    }
    if (estado.nombre === "Anulada") {
      throw new Error(`La ${cot.numero} ya está anulada`);
    }
    const anulada = estados.find((e) => e.nombre === "Anulada");
    if (!anulada) throw new Error("Estado 'Anulada' no existe en la BD");
    const { error: uErr } = await supabase
      .from("cotizaciones")
      .update({ estado_id: anulada.id })
      .eq("id", id);
    if (uErr) throw new Error(uErr.message);

    // El embudo no debe quedar con tarjetas muertas: oportunidad → Perdido
    const { data: opo } = await supabase
      .from("oportunidades")
      .select("*")
      .eq("cotizacion_id", id)
      .eq("activo", true)
      .maybeSingle();
    if (opo) {
      const { data: etapa } = await supabase
        .from("etapas_crm")
        .select("*")
        .eq("id", opo.etapa_id)
        .maybeSingle();
      if (etapa && !etapa.es_ganada && !etapa.es_perdida) {
        const { data: perdida } = await supabase
          .from("etapas_crm")
          .select("*")
          .eq("es_perdida", true)
          .eq("activo", true)
          .limit(1)
          .maybeSingle();
        if (perdida) {
          const { error: pErr } = await supabase
            .from("oportunidades")
            .update({ etapa_id: perdida.id })
            .eq("id", opo.id);
          if (pErr) throw new Error(pErr.message);
        }
      }
    }
  }

  async duplicar(id: string): Promise<{ id: string; numero: string }> {
    const det = await this.obtener(id);
    if (!det) throw new Error("La cotización no existe");
    return this.crear({
      cliente_id: det.cotizacion.cliente_id,
      vendedor_id: det.cotizacion.vendedor_id,
      origen: det.cotizacion.origen,
      segmento: det.cotizacion.segmento,
      no_facturar: det.cotizacion.no_facturar,
      pago_anticipado_completo: det.cotizacion.pago_anticipado_completo,
      descuento_pct: det.cotizacion.descuento_pct,
      tiempo_entrega: det.cotizacion.tiempo_entrega,
      notas: det.cotizacion.notas,
      items: det.items.map((i) => ({
        producto_id: i.producto_id,
        descripcion: i.descripcion,
        es_transporte: i.es_transporte,
        aplica_iva: i.aplica_iva,
        cantidad: i.cantidad,
        precio_unit: i.precio_unit,
        descuento_pct: i.descuento_pct,
        alto_override_cm: i.alto_override_cm,
        fondo_override_cm: i.fondo_override_cm,
        color: i.color,
        recargos: i.recargos,
      })),
    });
  }

  async crear(input: CotizacionInput): Promise<{ id: string; numero: string }> {
    validarInput(input);
    const supabase = await createClient();

    const { data: numRaw, error: nErr } = await supabase.rpc(
      "fn_siguiente_numero",
      { p_clave: "cotizacion" },
    );
    if (nErr) throw new Error(nErr.message);

    // Numeración COT_<FUENTE>_#### (misma lógica que las OP): consecutivo
    // GLOBAL de la secuencia + sigla según la fuente del lead.
    const ABBR: Record<string, string> = {
      whatsapp: "WA",
      showroom: "SR",
      shopify: "SPFY",
      planner: "BFP",
      chat: "CHAT",
      manual: "MAN",
    };
    const origen = input.origen ?? "manual";
    const digitos = String(numRaw).replace(/\D/g, "").padStart(4, "0");
    const numero = `COT_${ABBR[origen] ?? "MAN"}_${digitos}`;

    const borrador = await this.estadoPorNombre("Borrador");
    const valida = new Date();
    valida.setDate(valida.getDate() + 15); // regla: creación + 15 días

    const { data: cot, error } = await supabase
      .from("cotizaciones")
      .insert({
        numero,
        cliente_id: input.cliente_id,
        vendedor_id: input.vendedor_id,
        segmento: input.segmento,
        estado_id: borrador.id,
        no_facturar: input.no_facturar,
        descuento_pct: input.descuento_pct,
        pago_anticipado_completo: input.pago_anticipado_completo,
        valida_hasta: valida.toISOString().slice(0, 10),
        tiempo_entrega: input.tiempo_entrega,
        origen,
        notas: input.notas,
      })
      .select("id, numero")
      .single();
    if (error) throw new Error(error.message);

    await this.insertarItems(cot.id, input.items);
    await this.vincularAlEmbudo(cot.id, input.cliente_id, input.vendedor_id);
    return { id: cot.id, numero: cot.numero };
  }

  /**
   * Regla de Juan (19-jul-2026): TODA cotización, venga de donde venga,
   * queda en el embudo CRM. Al crearla nace su oportunidad en
   * "Elaborando Cotización y/o Render"; al marcarla Enviada pasa a
   * "Cotizado". (El endpoint del planner crea la suya aparte — aquí se
   * verifica que no exista antes de insertar.) Si el embudo falla, la
   * cotización NO se pierde: se avisa por consola y sigue.
   */
  private async vincularAlEmbudo(
    cotizacionId: string,
    cliente_id: string,
    vendedor_id: string,
  ): Promise<void> {
    try {
      const supabase = await createClient();
      const { data: existente } = await supabase
        .from("oportunidades")
        .select("id")
        .eq("cotizacion_id", cotizacionId)
        .eq("activo", true)
        .maybeSingle();
      if (existente) return;
      const { data: etapas } = await supabase
        .from("etapas_crm")
        .select("*")
        .eq("activo", true)
        .order("orden");
      const lista = etapas ?? [];
      const etapa =
        lista.find((e) => e.nombre === "Elaborando Cotización y/o Render") ??
        lista.find((e) => !e.es_ganada && !e.es_perdida);
      if (!etapa) return;
      const { error } = await supabase.from("oportunidades").insert({
        cliente_id,
        vendedor_id,
        cotizacion_id: cotizacionId,
        etapa_id: etapa.id,
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      console.warn(
        "No se pudo vincular la cotización al embudo CRM:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  async actualizar(id: string, input: CotizacionInput): Promise<void> {
    validarInput(input);
    const supabase = await createClient();
    const det = await this.obtener(id);
    if (!det) throw new Error(`Cotización ${id} no existe`);
    if (det.estado.nombre !== "Borrador") {
      throw new Error(
        `Solo los borradores se editan; la ${det.cotizacion.numero} está ${det.estado.nombre}. Duplíquela para re-cotizar.`,
      );
    }
    const { error } = await supabase
      .from("cotizaciones")
      .update({
        cliente_id: input.cliente_id,
        vendedor_id: input.vendedor_id,
        segmento: input.segmento,
        no_facturar: input.no_facturar,
        pago_anticipado_completo: input.pago_anticipado_completo,
        descuento_pct: input.descuento_pct,
        tiempo_entrega: input.tiempo_entrega,
        notas: input.notas,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    // reemplazo de ítems (requiere la policy DELETE de cotizacion_items)
    const { error: dErr } = await supabase
      .from("cotizacion_items")
      .delete()
      .eq("cotizacion_id", id);
    if (dErr) throw new Error(dErr.message);
    await this.insertarItems(id, input.items);
  }

  async marcarEnviada(id: string): Promise<void> {
    const supabase = await createClient();
    const det = await this.obtener(id);
    if (!det) throw new Error(`Cotización ${id} no existe`);
    if (det.estado.nombre !== "Borrador") {
      throw new Error(
        `La ${det.cotizacion.numero} ya está ${det.estado.nombre}`,
      );
    }
    if (!det.items.length) {
      throw new Error("No se puede enviar una cotización sin ítems");
    }
    const enviada = await this.estadoPorNombre("Enviada");
    const { error } = await supabase
      .from("cotizaciones")
      .update({ estado_id: enviada.id })
      .eq("id", id);
    if (error) throw new Error(error.message);

    // Embudo sincronizado: la oportunidad de esta cotización avanza a
    // "Cotizado" (si sigue viva y no está ganada/perdida).
    try {
      const { data: opo } = await supabase
        .from("oportunidades")
        .select("*")
        .eq("cotizacion_id", id)
        .eq("activo", true)
        .maybeSingle();
      if (!opo) return;
      const { data: etapas } = await supabase
        .from("etapas_crm")
        .select("*")
        .eq("activo", true);
      const lista = etapas ?? [];
      const actual = lista.find((e) => num(e.id) === num(opo.etapa_id));
      const cotizado = lista.find((e) => e.nombre === "Cotizado");
      if (cotizado && actual && !actual.es_ganada && !actual.es_perdida) {
        await supabase
          .from("oportunidades")
          .update({ etapa_id: cotizado.id })
          .eq("id", opo.id);
      }
    } catch (e) {
      console.warn(
        "No se pudo mover la oportunidad a Cotizado:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  async listarClientes(): Promise<Cliente[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toCliente);
  }

  async listarEstados(): Promise<EstadoCotizacion[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("estados_cotizacion")
      .select("*")
      .order("orden");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toEstado);
  }

  async listarVendedores(): Promise<Usuario[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("rol_id", 1)
      .eq("activo", true)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toUsuario);
  }
}

// ---------------------------------------------------------------
// CRM (embudo de oportunidades)
// ---------------------------------------------------------------

class SupabaseCrmRepository implements CrmRepository {
  async crearOportunidad(input: OportunidadNuevaInput): Promise<void> {
    if (!input.cliente_id) throw new Error("Seleccione el cliente");
    if (!input.vendedor_id) throw new Error("Seleccione el vendedor");
    const supabase = await createClient();
    const { data: etapas, error: eErr } = await supabase
      .from("etapas_crm")
      .select("*")
      .eq("activo", true)
      .order("orden");
    if (eErr) throw new Error(eErr.message);
    const inicial = (etapas ?? []).find((e) => !e.es_ganada && !e.es_perdida);
    if (!inicial) throw new Error("El embudo no tiene etapa inicial activa");
    const { error } = await supabase.from("oportunidades").insert({
      cliente_id: input.cliente_id,
      vendedor_id: input.vendedor_id,
      etapa_id: inicial.id,
      valor_estimado: input.valor_estimado,
      notas: input.notas,
    });
    if (error) throw new Error(error.message);
  }

  async listarOportunidades(
    filtros: FiltrosCrm = {},
  ): Promise<OportunidadCard[]> {
    const supabase = await createClient();
    const [
      { data: opos, error },
      { data: clientes },
      { data: usuarios },
      { data: estados },
    ] = await Promise.all([
      supabase.from("oportunidades").select("*").eq("activo", true),
      supabase.from("clientes").select("*"),
      supabase.from("usuarios").select("*"),
      supabase.from("estados_cotizacion").select("*"),
    ]);
    if (error) throw new Error(error.message);

    const cliMap = new Map((clientes ?? []).map((c) => [c.id, toCliente(c)]));
    const usrMap = new Map((usuarios ?? []).map((u) => [u.id, toUsuario(u)]));
    const estMap = new Map(
      (estados ?? []).map((e) => [num(e.id), e.nombre as string]),
    );

    const cotIds = [
      ...new Set((opos ?? []).map((o) => o.cotizacion_id).filter(Boolean)),
    ];
    const cotMap = new Map<string, Cotizacion>();
    const itemsMap = new Map<string, CotizacionItemConProducto[]>();
    if (cotIds.length) {
      const { data: cots } = await supabase
        .from("cotizaciones")
        .select("*")
        .in("id", cotIds as string[]);
      (cots ?? []).forEach((c) => cotMap.set(c.id, toCotizacion(c)));
      const { data: its } = await supabase
        .from("cotizacion_items")
        .select("*, productos(*)")
        .in("cotizacion_id", cotIds as string[]);
      for (const r of ordenarItems((its ?? []) as any[])) {
        const arr = itemsMap.get(r.cotizacion_id) ?? [];
        arr.push({
          ...toItem(r),
          producto: r.productos ? toProducto(r.productos) : null,
        });
        itemsMap.set(r.cotizacion_id, arr);
      }
    }

    // OP generada al ganar: la ficha enlaza a Producción (cierra el
    // círculo — el usuario ve que la venta ya pasó a la planta).
    const opPorCotizacion = new Map<string, { id: string; numero: string }>();
    if (cotIds.length) {
      const { data: ops } = await supabase
        .from("ordenes_pedido")
        .select("id, numero, cotizacion_id")
        .in("cotizacion_id", cotIds as string[]);
      (ops ?? []).forEach((o: any) =>
        opPorCotizacion.set(o.cotizacion_id, { id: o.id, numero: o.numero }),
      );
    }

    const q = filtros.texto?.trim().toLowerCase();
    return (opos ?? [])
      .map((r) => {
        const o = toOportunidad(r);
        const cot = o.cotizacion_id ? cotMap.get(o.cotizacion_id) : undefined;
        const its = cot ? (itemsMap.get(cot.id) ?? []) : [];
        const total = cot ? calcularTotales(its, cot).total : 0;
        return {
          oportunidad: o,
          cliente: cliMap.get(o.cliente_id)!,
          vendedor: usrMap.get(o.vendedor_id)!,
          cotizacion: cot
            ? {
                id: cot.id,
                numero: cot.numero,
                estado: estMap.get(cot.estado_id) ?? "—",
                total,
                tiene_items: its.length > 0,
              }
            : null,
          valor: cot && its.length > 0 ? total : (o.valor_estimado ?? 0),
          op: cot ? (opPorCotizacion.get(cot.id) ?? null) : null,
        } satisfies OportunidadCard;
      })
      .filter((c) => {
        if (filtros.vendedor_id && c.vendedor.id !== filtros.vendedor_id)
          return false;
        if (q) {
          const blob = [
            c.cliente.nombre,
            c.cotizacion?.numero ?? "",
            c.oportunidad.notas ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.valor - a.valor);
  }

  async moverEtapa(
    oportunidad_id: string,
    etapa_id: number,
  ): Promise<ResultadoMoverCrm> {
    const supabase = await createClient();
    const { data: etapa, error: eErr } = await supabase
      .from("etapas_crm")
      .select("*")
      .eq("id", etapa_id)
      .single();
    if (eErr) throw new Error(`Etapa CRM ${etapa_id} no existe`);

    const { data: o, error: oErr } = await supabase
      .from("oportunidades")
      .select("*")
      .eq("id", oportunidad_id)
      .single();
    if (oErr) throw new Error(`Oportunidad ${oportunidad_id} no existe`);

    if (!etapa.es_ganada) {
      const { error } = await supabase
        .from("oportunidades")
        .update({ etapa_id })
        .eq("id", oportunidad_id);
      if (error) throw new Error(error.message);
      return {};
    }

    // Ganado: exige cotización con ítems (el trigger lo re-valida en BD)
    const cot = o.cotizacion_id
      ? toCotizacion(
          (
            await supabase
              .from("cotizaciones")
              .select("*")
              .eq("id", o.cotizacion_id)
              .single()
          ).data,
        )
      : null;
    const { data: itemsRaw } = cot
      ? await supabase
          .from("cotizacion_items")
          .select("*")
          .eq("cotizacion_id", cot.id)
      : { data: [] as any[] };
    const items = ordenarItems((itemsRaw ?? []) as any[]).map(toItem);
    if (!cot || items.length === 0) {
      throw new Error(
        "Para ganar la oportunidad necesita una cotización con ítems. " +
          (cot ? `La ${cot.numero} está vacía.` : "Aún no tiene cotización."),
      );
    }

    const { error: uErr } = await supabase
      .from("oportunidades")
      .update({ etapa_id })
      .eq("id", oportunidad_id);
    if (uErr) {
      if (/sin una cotización con ítems/i.test(uErr.message)) {
        throw new Error(
          "Para ganar la oportunidad necesita una cotización con ítems.",
        );
      }
      throw new Error(uErr.message);
    }

    const { data: cli } = await supabase
      .from("clientes")
      .select("ciudad_id")
      .eq("id", o.cliente_id)
      .maybeSingle();

    const op = await getOpsRepository().crearOp({
      cliente_id: o.cliente_id,
      ciudad_id: cli?.ciudad_id != null ? num(cli.ciudad_id) : null,
      segmento: cot.segmento,
      origen_clave: "cotizacion",
      cotizacion_id: cot.id,
      vendedor_id: cot.vendedor_id, // vendedor REAL heredado de la cotización
      notas: `OP generada automáticamente al ganar la oportunidad (cotización ${cot.numero}).`,
      items: items
        .filter((i) => i.producto_id !== null)
        .map((i) => ({
          producto_id: i.producto_id!,
          cantidad: i.cantidad,
          // la OP hereda el precio CON el descuento de línea ya aplicado
          precio_unit: Math.round(i.precio_unit * (1 - i.descuento_pct / 100)),
          color: i.color,
          alto_override_cm: i.alto_override_cm,
          fondo_override_cm: i.fondo_override_cm,
        })),
    });

    const { data: aprobada } = await supabase
      .from("estados_cotizacion")
      .select("id")
      .eq("nombre", "Aprobada")
      .single();
    if (aprobada) {
      await supabase
        .from("cotizaciones")
        .update({ estado_id: aprobada.id })
        .eq("id", cot.id);
    }
    return { opCreada: { id: op.id, numero: op.numero } };
  }

  async listarEtapas(): Promise<EtapaCrm[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("etapas_crm")
      .select("*")
      .eq("activo", true)
      .order("orden");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toEtapaCrm);
  }

  async listarVendedores(): Promise<Usuario[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("rol_id", 1)
      .eq("activo", true)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toUsuario);
  }
}

// ---------------------------------------------------------------
// Catálogos para el editor y el formato (fuentes reales)
// ---------------------------------------------------------------

export async function listarProductosCatalogo(): Promise<Producto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toProducto);
}

export async function listarDimensiones(): Promise<ProductoDimension[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("producto_dimensiones")
    .select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    producto_id: r.producto_id,
    eje: r.eje,
    min_cm: num(r.min_cm),
    max_cm: num(r.max_cm),
    default_cm: num(r.default_cm),
    precio_por_cm_extra: num(r.precio_por_cm_extra),
  }));
}

export async function listarCategoriasProducto(): Promise<
  { id: number; nombre: string; orden: number }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias_producto")
    .select("id, nombre, orden")
    .order("orden");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: num(r.id),
    nombre: r.nombre,
    orden: num(r.orden),
  }));
}

/**
 * Alta rápida de producto desde el editor de cotizaciones. El producto
 * nace en la BD (fuente de la verdad del catálogo) y queda disponible
 * de inmediato para cotizar; se enriquece después (foto, BOM, dims).
 */
export interface ProductoNuevoInput {
  nombre: string;
  sku: string;
  categoria_id: number;
  origen: "propio" | "comercializado";
  precio_lista: number;
  es_rack?: boolean;
}

export async function crearProducto(
  input: ProductoNuevoInput,
): Promise<Producto> {
  const nombre = input.nombre.trim();
  const sku = input.sku.trim();
  if (!nombre || !sku) throw new Error("Nombre y SKU son obligatorios.");
  if (!Number.isFinite(input.precio_lista) || input.precio_lista < 0) {
    throw new Error("El precio de lista no puede ser negativo.");
  }
  const supabase = await createClient();
  const { data: und, error: uErr } = await supabase
    .from("unidades_medida")
    .select("id")
    .eq("clave", "und")
    .single();
  if (uErr) throw new Error(uErr.message);

  const { data, error } = await supabase
    .from("productos")
    .insert({
      sku,
      nombre,
      categoria_id: input.categoria_id,
      clasificacion: input.es_rack ? "MTO" : "MTS",
      origen: input.origen,
      es_rack: input.es_rack ?? false,
      unidad_id: und.id,
      precio_lista: input.precio_lista,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new Error(`Ya existe un producto con el SKU "${sku}".`);
    }
    throw new Error(error.message);
  }
  return toProducto(data);
}

/** Alta rápida de cliente desde el editor (se completa después en el ERP). */
export interface ClienteNuevoInput {
  nombre: string;
  tipo: "persona" | "empresa";
  nit_cedula?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}

export async function crearClienteRapido(
  input: ClienteNuevoInput,
): Promise<Cliente> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre del cliente es obligatorio.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({
      tipo: input.tipo,
      nombre,
      nit_cedula: input.nit_cedula?.trim() || null,
      telefono: input.telefono?.trim() || null,
      email: input.email?.trim() || null,
      direccion: input.direccion?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toCliente(data);
}

// ---------------------------------------------------------------
// Factories server-only (mismo patrón que ops-server)
// ---------------------------------------------------------------

const globalRepo = globalThis as unknown as {
  __crmRepositorioServer?: CrmRepository;
  __cotRepositorioServer?: CotizacionesRepository;
};

export function getCrmRepository(): CrmRepository {
  globalRepo.__crmRepositorioServer ??= new SupabaseCrmRepository();
  return globalRepo.__crmRepositorioServer;
}

export function getCotizacionesRepository(): CotizacionesRepository {
  globalRepo.__cotRepositorioServer ??= new SupabaseCotizacionesRepository();
  return globalRepo.__cotRepositorioServer;
}
