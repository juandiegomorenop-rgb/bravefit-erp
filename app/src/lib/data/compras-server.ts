/**
 * Repositorio REAL de Solicitudes de Compra sobre Supabase (server-only).
 * Mismas reglas del mock (una SC por tipo de material, estados
 * pendiente→en_cotizacion→comprado / rechazada, recepción ítem×ítem con
 * faltantes en seguimiento). Numeración SC-### vía fn_siguiente_numero.
 *
 * NOTA kardex: la recepción registra lo recibido EN LA SOLICITUD pero
 * NO genera movimientos entrada_compra todavía — ese movimiento exige
 * costo unitario por material (check de la BD) y hoy el costo entra por
 * la foto de la factura / el conteo periódico. Cuando definamos captura
 * de costos en la recepción, se conecta aquí.
 */
import type {
  ComprasRepository,
  FaltanteCard,
  FiltrosCompras,
  RecepcionItemInput,
  ScItemDetalle,
  ScItemInput,
  SolicitudCard,
} from "@/lib/data/compras";
import { createClient } from "@/lib/supabase/server";
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

/* eslint-disable @typescript-eslint/no-explicit-any */

const num = (v: unknown): number =>
  typeof v === "string" ? Number(v) : (v as number);
const numN = (v: unknown): number | null =>
  v === null || v === undefined ? null : num(v);

const toSc = (r: any): SolicitudCompra => ({
  id: r.id,
  numero: r.numero,
  tipo_material_id: num(r.tipo_material_id),
  proveedor_id: r.proveedor_id ?? null,
  solicitante_id: r.solicitante_id,
  estado: r.estado,
  valor_estimado: numN(r.valor_estimado),
  fecha_entrega: r.fecha_entrega ?? null,
  op_id: r.op_id ?? null,
  notas: r.notas ?? null,
  activo: r.activo,
  eliminado_en: r.eliminado_en ?? null,
  creado_en: r.creado_en,
});
const toScItem = (r: any): ScItem => ({
  id: r.id,
  sc_id: r.sc_id,
  material_id: r.material_id ?? null,
  descripcion: r.descripcion ?? null,
  cantidad: num(r.cantidad),
});
const toRecepcion = (r: any): Recepcion => ({
  id: r.id,
  sc_id: r.sc_id,
  usuario_id: r.usuario_id,
  fecha: r.fecha,
  cerrada: r.cerrada,
});
const toRecItem = (r: any): RecepcionItem => ({
  id: r.id,
  recepcion_id: r.recepcion_id,
  sc_item_id: r.sc_item_id,
  cant_recibida: num(r.cant_recibida),
  cant_faltante: num(r.cant_faltante),
  nota: r.nota ?? null,
  faltante_resuelto: r.faltante_resuelto,
});
const toMaterial = (r: any): Material => ({
  id: r.id,
  nombre: r.nombre,
  tipo_material_id: num(r.tipo_material_id),
  unidad_id: num(r.unidad_id),
  costo_promedio: num(r.costo_promedio),
  buffer_min: num(r.buffer_min),
  buffer_max: num(r.buffer_max),
  activo: r.activo,
  eliminado_en: r.eliminado_en ?? null,
});
const toUsuario = (r: any): Usuario => ({
  id: r.id,
  rol_id: num(r.rol_id),
  nombre: r.nombre,
  email: r.email,
  activo: r.activo,
});

class SupabaseComprasRepository implements ComprasRepository {
  async listarTiposMaterial(): Promise<TipoMaterial[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tipos_material")
      .select("*")
      .order("id");
    if (error) throw new Error(error.message);
    return (data ?? []).map((t: any) => ({ id: num(t.id), nombre: t.nombre }));
  }

  async listarMateriales(): Promise<Material[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("materiales")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toMaterial);
  }

  async listarProveedores(): Promise<Proveedor[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("proveedores")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      nit: p.nit ?? null,
      contacto: p.contacto ?? null,
      telefono: p.telefono ?? null,
      email: p.email ?? null,
      notas: p.notas ?? null,
      activo: p.activo,
    }));
  }

  /** Carga todo el grafo de compras (volúmenes pequeños) y arma en JS. */
  private async grafo() {
    const supabase = await createClient();
    const [scs, items, recs, recItems, tipos, provs, usuarios, mats] =
      await Promise.all([
        supabase.from("solicitudes_compra").select("*").eq("activo", true),
        supabase.from("sc_items").select("*"),
        supabase.from("recepciones").select("*"),
        supabase.from("recepcion_items").select("*"),
        this.listarTiposMaterial(),
        this.listarProveedores(),
        supabase.from("usuarios").select("*"),
        this.listarMateriales(),
      ]);
    for (const r of [scs, items, recs, recItems]) {
      if ((r as any).error) throw new Error((r as any).error.message);
    }
    return {
      scs: ((scs.data ?? []) as any[]).map(toSc),
      items: ((items.data ?? []) as any[]).map(toScItem),
      recs: ((recs.data ?? []) as any[]).map(toRecepcion),
      recItems: ((recItems.data ?? []) as any[]).map(toRecItem),
      tipos,
      provs,
      usuarios: ((usuarios.data ?? []) as any[]).map(toUsuario),
      mats: new Map(mats.map((m) => [m.id, m])),
    };
  }

  async listar(filtros: FiltrosCompras = {}): Promise<SolicitudCard[]> {
    const g = await this.grafo();
    const q = filtros.texto?.trim().toLowerCase();

    const detalle = (it: ScItem): ScItemDetalle => {
      const ri = g.recItems.filter((r) => r.sc_item_id === it.id);
      return {
        ...it,
        material: it.material_id ? (g.mats.get(it.material_id) ?? null) : null,
        recibido: ri.reduce((a, r) => a + r.cant_recibida, 0),
        faltante_abierto: ri
          .filter((r) => !r.faltante_resuelto)
          .reduce((a, r) => a + r.cant_faltante, 0),
      };
    };

    return g.scs
      .map((sc): SolicitudCard => {
        const items = g.items.filter((i) => i.sc_id === sc.id).map(detalle);
        const pedidas = items.reduce((a, i) => a + i.cantidad, 0);
        const recibidas = items.reduce((a, i) => a + i.recibido, 0);
        const faltantes = items.reduce((a, i) => a + i.faltante_abierto, 0);
        return {
          sc,
          tipo: g.tipos.find((t) => t.id === sc.tipo_material_id) ?? {
            id: sc.tipo_material_id,
            nombre: "—",
          },
          proveedor: g.provs.find((p) => p.id === sc.proveedor_id) ?? null,
          solicitante:
            g.usuarios.find((u) => u.id === sc.solicitante_id) ??
            ({ id: sc.solicitante_id, rol_id: 0, nombre: "—", email: "", activo: true } as Usuario),
          items,
          unidades_pedidas: pedidas,
          unidades_recibidas: recibidas,
          faltantes_abiertos: faltantes,
          recepciones: g.recs
            .filter((r) => r.sc_id === sc.id)
            .sort((a, b) => b.fecha.localeCompare(a.fecha)),
          recepcion_completa: pedidas > 0 && recibidas >= pedidas && faltantes === 0,
        };
      })
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
    if (input.items.length === 0) {
      throw new Error("Agregue al menos un ítem a la solicitud");
    }
    for (const it of input.items) {
      if (!it.material_id && !it.descripcion?.trim()) {
        throw new Error("Todo ítem necesita material o descripción");
      }
      if (it.cantidad <= 0)
        throw new Error("Las cantidades deben ser mayores a 0");
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión no válida");

    const { data: numero, error: nErr } = await supabase.rpc(
      "fn_siguiente_numero",
      { p_clave: "sc" },
    );
    if (nErr) throw new Error(nErr.message);

    const { data: sc, error } = await supabase
      .from("solicitudes_compra")
      .insert({
        numero: String(numero),
        tipo_material_id: input.tipo_material_id,
        solicitante_id: user.id,
        estado: "pendiente",
        notas: input.notas,
      })
      .select("id, numero")
      .single();
    if (error) throw new Error(error.message);

    const { error: iErr } = await supabase.from("sc_items").insert(
      input.items.map((it) => ({
        sc_id: sc.id,
        material_id: it.material_id,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
      })),
    );
    if (iErr) throw new Error(iErr.message);
    return { id: sc.id, numero: sc.numero };
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
    const supabase = await createClient();
    const { data: r, error: sErr } = await supabase
      .from("solicitudes_compra")
      .select("*")
      .eq("id", id)
      .eq("activo", true)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!r) throw new Error("La solicitud no existe");
    const sc = toSc(r);

    const permitidas: Record<string, string[]> = {
      pendiente: ["en_cotizacion", "rechazada"],
      en_cotizacion: ["comprado", "rechazada"],
      comprado: [],
      rechazada: [],
    };
    if (!permitidas[sc.estado].includes(estado)) {
      throw new Error(
        `La ${sc.numero} está ${sc.estado}: no puede pasar a ${estado}`,
      );
    }
    const patch: Record<string, unknown> = { estado };
    if (estado === "comprado") {
      if (!datos?.valor_estimado || datos.valor_estimado <= 0) {
        throw new Error(
          "Para marcar comprada digite el valor cotizado por el proveedor",
        );
      }
      if (!datos.fecha_entrega) {
        throw new Error(
          "Para marcar comprada indique la fecha de entrega acordada",
        );
      }
      patch.valor_estimado = datos.valor_estimado;
      patch.fecha_entrega = datos.fecha_entrega;
      if (datos.proveedor_id !== undefined)
        patch.proveedor_id = datos.proveedor_id;
    }
    if (estado === "en_cotizacion" && datos?.valor_estimado) {
      patch.valor_estimado = datos.valor_estimado;
    }
    const { error } = await supabase
      .from("solicitudes_compra")
      .update(patch)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async registrarRecepcion(
    sc_id: string,
    items: RecepcionItemInput[],
  ): Promise<void> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión no válida");

    const { data: r } = await supabase
      .from("solicitudes_compra")
      .select("*")
      .eq("id", sc_id)
      .eq("activo", true)
      .maybeSingle();
    if (!r) throw new Error("La solicitud no existe");
    const sc = toSc(r);
    if (sc.estado !== "comprado") {
      throw new Error(
        `Solo se reciben solicitudes compradas (la ${sc.numero} está ${sc.estado})`,
      );
    }
    const utiles = items.filter(
      (i) => i.cant_recibida > 0 || i.cant_faltante > 0,
    );
    if (!utiles.length) {
      throw new Error("Registre al menos una cantidad recibida o un faltante");
    }

    // No recibir más de lo pedido (la BD lo revalida con su trigger)
    const [{ data: scItems }, { data: prevRaw }] = await Promise.all([
      supabase.from("sc_items").select("*").eq("sc_id", sc_id),
      supabase
        .from("recepcion_items")
        .select("sc_item_id, cant_recibida, recepciones!inner(sc_id)")
        .eq("recepciones.sc_id", sc_id),
    ]);
    const pedidoPor = new Map(
      ((scItems ?? []) as any[]).map((i) => [i.id, toScItem(i)]),
    );
    const previaPor = new Map<string, number>();
    for (const p of (prevRaw ?? []) as any[]) {
      previaPor.set(
        p.sc_item_id,
        (previaPor.get(p.sc_item_id) ?? 0) + num(p.cant_recibida),
      );
    }
    for (const it of utiles) {
      const scItem = pedidoPor.get(it.sc_item_id);
      if (!scItem) throw new Error("Ítem de la solicitud no encontrado");
      if (it.cant_recibida < 0 || it.cant_faltante < 0) {
        throw new Error("Cantidades negativas no permitidas");
      }
      const previa = previaPor.get(it.sc_item_id) ?? 0;
      if (previa + it.cant_recibida > scItem.cantidad) {
        throw new Error(
          `${scItem.descripcion ?? "Ítem"}: recibiría ${previa + it.cant_recibida} y solo se pidieron ${scItem.cantidad}`,
        );
      }
    }

    const { data: rec, error: rErr } = await supabase
      .from("recepciones")
      .insert({
        sc_id,
        usuario_id: user.id,
        cerrada: utiles.every((i) => i.cant_faltante === 0),
      })
      .select("id")
      .single();
    if (rErr) throw new Error(rErr.message);

    const { error: iErr } = await supabase.from("recepcion_items").insert(
      utiles.map((it) => ({
        recepcion_id: rec.id,
        sc_item_id: it.sc_item_id,
        cant_recibida: it.cant_recibida,
        cant_faltante: it.cant_faltante,
        nota: it.nota,
      })),
    );
    if (iErr) throw new Error(iErr.message);
  }

  async resolverFaltante(
    recepcion_item_id: string,
    nota?: string,
  ): Promise<void> {
    const supabase = await createClient();
    const { data: ri, error } = await supabase
      .from("recepcion_items")
      .select("*, recepciones(sc_id)")
      .eq("id", recepcion_item_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ri) throw new Error("Faltante no encontrado");
    if (ri.faltante_resuelto) throw new Error("Este faltante ya estaba resuelto");

    const nuevaNota = nota
      ? ri.nota
        ? `${ri.nota} · ${nota}`
        : nota
      : ri.nota;
    const { error: uErr } = await supabase
      .from("recepcion_items")
      .update({ faltante_resuelto: true, nota: nuevaNota })
      .eq("id", recepcion_item_id);
    if (uErr) throw new Error(uErr.message);

    // Cerrar recepciones de la SC si no quedan faltantes abiertos
    const sc_id = (ri as any).recepciones?.sc_id;
    if (sc_id) {
      const { data: abiertos } = await supabase
        .from("recepcion_items")
        .select("id, recepciones!inner(sc_id)")
        .eq("recepciones.sc_id", sc_id)
        .eq("faltante_resuelto", false)
        .gt("cant_faltante", 0);
      if (!(abiertos ?? []).length) {
        await supabase
          .from("recepciones")
          .update({ cerrada: true })
          .eq("sc_id", sc_id);
      }
    }
  }

  async listarFaltantes(): Promise<FaltanteCard[]> {
    const g = await this.grafo();
    return g.recItems
      .filter((r) => r.cant_faltante > 0 && !r.faltante_resuelto)
      .map((r) => {
        const rec = g.recs.find((x) => x.id === r.recepcion_id);
        const sc = g.scs.find((s) => s.id === rec?.sc_id);
        const scItem = g.items.find((i) => i.id === r.sc_item_id);
        return {
          recepcion_item: r,
          sc_id: sc?.id ?? "",
          sc_numero: sc?.numero ?? "—",
          material_nombre:
            (scItem?.material_id
              ? g.mats.get(scItem.material_id)?.nombre
              : null) ??
            scItem?.descripcion ??
            "Ítem",
          fecha_recepcion: rec?.fecha ?? "",
        };
      })
      .filter((f) => f.sc_id)
      .sort((a, b) => a.fecha_recepcion.localeCompare(b.fecha_recepcion));
  }
}

// ---------------------------------------------------------------
// Sugerencia de reposición con JUEGO COMPLETO (pedido de Juan):
// si la platina pedida hace parte del BOM de un producto (ej. P012 de
// los J-Locks), se sugieren también las DEMÁS platinas de esos mismos
// productos que estén en REPONER, cada una con óptimo − disponible.
// ---------------------------------------------------------------

export interface SugerenciaSc {
  material_id: string;
  nombre: string;
  cantidad: number;
  /** true = vino de completar el juego (no fue la pedida). */
  companero: boolean;
}

export async function sugerirReposicion(
  materialId: string,
): Promise<SugerenciaSc[]> {
  const supabase = await createClient();
  const { data: mat } = await supabase
    .from("materiales")
    .select("*")
    .eq("id", materialId)
    .maybeSingle();
  if (!mat) return [];
  const target = toMaterial(mat);

  const { data: exs } = await supabase
    .from("existencias")
    .select("material_id, cantidad_disponible")
    .eq("tipo", "materia_prima");
  const disponible = new Map(
    ((exs ?? []) as any[]).map((e) => [e.material_id, num(e.cantidad_disponible)]),
  );
  const faltanteDe = (m: Material) =>
    Math.max(0, Math.ceil(m.buffer_max - (disponible.get(m.id) ?? 0)));

  const out: SugerenciaSc[] = [
    {
      material_id: target.id,
      nombre: target.nombre,
      cantidad: Math.max(1, faltanteDe(target)),
      companero: false,
    },
  ];

  // Productos cuyos BOM usan el material pedido → sus demás materiales
  const { data: usos } = await supabase
    .from("producto_componentes")
    .select("producto_id")
    .eq("material_id", materialId);
  const productoIds = [...new Set((usos ?? []).map((u: any) => u.producto_id))];
  if (productoIds.length) {
    const { data: comps } = await supabase
      .from("producto_componentes")
      .select("material_id")
      .in("producto_id", productoIds)
      .not("material_id", "is", null)
      .neq("material_id", materialId);
    const companIds = [...new Set((comps ?? []).map((c: any) => c.material_id))];
    if (companIds.length) {
      const { data: mats } = await supabase
        .from("materiales")
        .select("*")
        .in("id", companIds)
        .eq("activo", true)
        .eq("tipo_material_id", target.tipo_material_id); // regla: SC por tipo
      const companeros = ((mats ?? []) as any[])
        .map(toMaterial)
        // solo los que están en REPONER (bajo el mínimo): los urgentes
        .filter((m) => (disponible.get(m.id) ?? 0) < m.buffer_min)
        .map((m) => ({
          material_id: m.id,
          nombre: m.nombre,
          cantidad: Math.max(1, faltanteDe(m)),
          companero: true,
        }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 12);
      out.push(...companeros);
    }
  }
  return out;
}

/**
 * Qué tipos de material vende cada proveedor (tabla
 * proveedor_tipos_material — la nutre Juan con su lista). Tolerante:
 * si la tabla aún no existe devuelve vacío y el selector no filtra.
 */
export async function listarProveedorTipos(): Promise<
  { proveedor_id: string; tipo_material_id: number }[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("proveedor_tipos_material")
      .select("proveedor_id, tipo_material_id");
    if (error) return [];
    return ((data ?? []) as any[]).map((r) => ({
      proveedor_id: r.proveedor_id,
      tipo_material_id: num(r.tipo_material_id),
    }));
  } catch {
    return [];
  }
}

const g = globalThis as unknown as {
  __comprasRepositorioServer?: ComprasRepository;
};

/** Factory server-only — la página de Compras consume ESTE. */
export function getComprasRepository(): ComprasRepository {
  g.__comprasRepositorioServer ??= new SupabaseComprasRepository();
  return g.__comprasRepositorioServer;
}
