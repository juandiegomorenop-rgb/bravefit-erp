import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PUERTA DE ENTRADA DEL PLANNER — POST /api/planner/cotizaciones
 *
 * El planner (front-only) envía aquí la cotización terminada y el ERP:
 *   1. asigna el número del consecutivo COMPARTIDO → COT_BFP_####,
 *   2. crea/encuentra el cliente,
 *   3. crea la cotización (origen 'planner', estado Enviada) + ítems
 *      (matcheados por SKU contra el catálogo; los que no existan entran
 *      como ítem libre y se reportan en `skus_sin_catalogo`),
 *   4. la mete al embudo CRM en "Cotizado" para seguimiento,
 *   5. devuelve { numero } para estamparlo en el PDF del planner.
 *
 * Seguridad: header `Authorization: Bearer <PLANNER_API_KEY>` (env).
 * Modo prueba: body con `dry_run: true` valida y matchea sin escribir
 * ni consumir consecutivo.
 */

interface ItemIn {
  sku?: string | null;
  descripcion?: string | null;
  cantidad: number;
  precio_unit: number;
  descuento_pct?: number;
  color?: string | null;
  alto_override_cm?: number | null;
  fondo_override_cm?: number | null;
  es_transporte?: boolean;
  aplica_iva?: boolean;
  recargos?: unknown[];
}

interface BodyIn {
  dry_run?: boolean;
  cliente: {
    nombre: string;
    nit_cedula?: string | null;
    telefono?: string | null;
    email?: string | null;
    ciudad?: string | null;
    direccion?: string | null;
    tipo?: "persona" | "empresa";
  };
  segmento?: "B2B" | "B2C";
  vendedor_email?: string | null;
  pago_anticipado_completo?: boolean;
  descuento_pct?: number;
  no_facturar?: boolean;
  tiempo_entrega?: string | null;
  notas?: string | null;
  items: ItemIn[];
}

const bad = (status: number, error: string) =>
  NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  // ---- auth por API key ----
  const apiKey = process.env.PLANNER_API_KEY;
  if (!apiKey) {
    return bad(503, "PLANNER_API_KEY no configurada en el servidor.");
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${apiKey}`) {
    return bad(401, "API key inválida.");
  }

  // ---- payload ----
  let body: BodyIn;
  try {
    body = await req.json();
  } catch {
    return bad(400, "El cuerpo debe ser JSON.");
  }
  if (!body?.cliente?.nombre?.trim()) {
    return bad(400, "cliente.nombre es obligatorio.");
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return bad(400, "La cotización debe traer al menos un ítem.");
  }
  for (const [i, it] of body.items.entries()) {
    if (!(it.cantidad > 0)) return bad(400, `items[${i}].cantidad debe ser > 0.`);
    if (!(it.precio_unit >= 0)) return bad(400, `items[${i}].precio_unit inválido.`);
    if (!it.sku && !it.descripcion) {
      return bad(400, `items[${i}] necesita sku o descripcion.`);
    }
  }

  const supabase = createAdminClient();

  // ---- match de SKUs contra el catálogo (fuente de la verdad) ----
  const skus = [...new Set(body.items.map((i) => i.sku).filter(Boolean))] as string[];
  const porSku = new Map<string, { id: string }>();
  if (skus.length) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, sku")
      .in("sku", skus);
    if (error) return bad(500, error.message);
    for (const p of data ?? []) porSku.set(p.sku, { id: p.id });
  }
  const skusSinCatalogo = skus.filter((s) => !porSku.has(s));

  if (body.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      skus_sin_catalogo: skusSinCatalogo,
    });
  }

  // ---- vendedor (por email; fallback al admin principal) ----
  const emailVend = body.vendedor_email?.trim() || "juanmoreno@bravefit.co";
  const { data: vend } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", emailVend)
    .maybeSingle();
  if (!vend) return bad(400, `Vendedor '${emailVend}' no existe en usuarios.`);

  // ---- cliente: encontrar por cédula/email, si no crear ----
  const c = body.cliente;
  let clienteId: string | null = null;
  if (c.nit_cedula?.trim()) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .eq("nit_cedula", c.nit_cedula.trim())
      .eq("activo", true)
      .limit(1)
      .maybeSingle();
    clienteId = data?.id ?? null;
  }
  if (!clienteId && c.email?.trim()) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .eq("email", c.email.trim())
      .eq("activo", true)
      .limit(1)
      .maybeSingle();
    clienteId = data?.id ?? null;
  }
  if (!clienteId) {
    let ciudadId: number | null = null;
    if (c.ciudad?.trim()) {
      const { data } = await supabase
        .from("ciudades")
        .select("id")
        .ilike("nombre", c.ciudad.trim())
        .limit(1)
        .maybeSingle();
      ciudadId = data?.id ?? null;
    }
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        tipo: c.tipo ?? "persona",
        nombre: c.nombre.trim(),
        nit_cedula: c.nit_cedula?.trim() || null,
        telefono: c.telefono?.trim() || null,
        email: c.email?.trim() || null,
        ciudad_id: ciudadId,
        direccion: c.direccion?.trim() || null,
        canal_preferido: "planner",
      })
      .select("id")
      .single();
    if (error) return bad(500, `No se pudo crear el cliente: ${error.message}`);
    clienteId = data.id;
  }

  // ---- número del consecutivo compartido → COT_BFP_#### ----
  const { data: numRaw, error: nErr } = await supabase.rpc("fn_siguiente_numero", {
    p_clave: "cotizacion",
  });
  if (nErr) return bad(500, nErr.message);
  const numero = `COT_BFP_${String(numRaw).replace(/\D/g, "").padStart(4, "0")}`;

  // ---- cotización (origen planner, estado Enviada, vigencia 15 días) ----
  const { data: estado, error: eErr } = await supabase
    .from("estados_cotizacion")
    .select("id")
    .eq("nombre", "Enviada")
    .single();
  if (eErr) return bad(500, eErr.message);
  const valida = new Date();
  valida.setDate(valida.getDate() + 15);

  const { data: cot, error: cErr } = await supabase
    .from("cotizaciones")
    .insert({
      numero,
      cliente_id: clienteId,
      vendedor_id: vend.id,
      segmento: body.segmento ?? "B2C",
      estado_id: estado.id,
      no_facturar: body.no_facturar ?? false,
      descuento_pct: body.descuento_pct ?? 0,
      pago_anticipado_completo: body.pago_anticipado_completo ?? false,
      valida_hasta: valida.toISOString().slice(0, 10),
      tiempo_entrega: body.tiempo_entrega ?? null,
      origen: "planner",
      notas: body.notas ?? null,
    })
    .select("id, numero")
    .single();
  if (cErr) return bad(500, cErr.message);

  const filas = body.items.map((it) => ({
    cotizacion_id: cot.id,
    producto_id: it.sku ? (porSku.get(it.sku)?.id ?? null) : null,
    descripcion:
      it.sku && !porSku.has(it.sku)
        ? `${it.descripcion ?? it.sku} [SKU planner: ${it.sku}]`
        : (it.descripcion ?? null),
    es_transporte: it.es_transporte ?? false,
    aplica_iva: it.aplica_iva ?? !(it.es_transporte ?? false),
    cantidad: it.cantidad,
    precio_unit: it.precio_unit,
    descuento_pct: it.descuento_pct ?? 0,
    alto_override_cm: it.alto_override_cm ?? null,
    fondo_override_cm: it.fondo_override_cm ?? null,
    color: it.color ?? null,
    recargos: it.recargos ?? [],
  }));
  const { error: iErr } = await supabase.from("cotizacion_items").insert(filas);
  if (iErr) return bad(500, `Ítems: ${iErr.message}`);

  // ---- embudo CRM: entra en "Cotizado" para seguimiento ----
  const { data: etapa } = await supabase
    .from("etapas_crm")
    .select("id")
    .eq("nombre", "Cotizado")
    .single();
  if (etapa) {
    await supabase.from("oportunidades").insert({
      cliente_id: clienteId,
      cotizacion_id: cot.id,
      etapa_id: etapa.id,
      vendedor_id: vend.id,
      notas: "Creada automáticamente desde el Bravefit Planner",
    });
  }

  return NextResponse.json({
    ok: true,
    id: cot.id,
    numero: cot.numero,
    skus_sin_catalogo: skusSinCatalogo,
  });
}
