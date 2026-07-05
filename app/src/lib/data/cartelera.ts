/**
 * Data layer de Cartelera (comunicación interna) — INTERCAMBIABLE.
 *
 * Todo el equipo publica noticias, eventos e información importante
 * (p.ej. el resumen del Comité Operativo semanal), comenta, reacciona y
 * sube imágenes. En producción las imágenes van al bucket Storage
 * 'cartelera'; en el mock se guardan como data URL en memoria.
 *
 * `usuarioActual` simula el auth.uid() de quien está viendo (para saber
 * qué reacciones son suyas y qué puede editar). Hoy: Juan (u-01, Admin).
 */

import { USUARIOS } from "@/lib/data/ops";
import { tsRel } from "@/lib/data/ops";
import type {
  Publicacion,
  PublicacionComentario,
  PublicacionReaccion,
  Usuario,
} from "@/lib/types/db";

export const USUARIO_ACTUAL = "u-01"; // Juan (en producción: auth.uid())

export const REACCIONES = [
  { tipo: "like", emoji: "👍", nombre: "Me gusta" },
  { tipo: "celebra", emoji: "🎉", nombre: "Celebra" },
  { tipo: "importante", emoji: "⭐", nombre: "Importante" },
  { tipo: "idea", emoji: "💡", nombre: "Idea" },
] as const;

// ---------------------------------------------------------------
// Tipos enriquecidos para la UI
// ---------------------------------------------------------------

export interface ComentarioCard {
  comentario: PublicacionComentario;
  autor: Usuario;
}

export interface PublicacionCard {
  publicacion: Publicacion;
  autor: Usuario;
  comentarios: ComentarioCard[];
  /** Conteo por tipo de reacción. */
  reacciones: Record<string, number>;
  /** Reacciones del usuario actual (para resaltar los botones). */
  misReacciones: string[];
}

export interface NuevaPublicacion {
  tipo: Publicacion["tipo"];
  titulo: string | null;
  cuerpo: string;
  imagenes: string[];
  evento_fecha: string | null;
  evento_lugar: string | null;
  fijada: boolean;
}

export interface CarteleraRepository {
  listar(filtros?: { tipo?: Publicacion["tipo"]; texto?: string }): Promise<PublicacionCard[]>;
  publicar(input: NuevaPublicacion): Promise<Publicacion>;
  comentar(input: {
    publicacion_id: string;
    cuerpo: string;
    imagen_url: string | null;
  }): Promise<PublicacionComentario>;
  /** Alterna una reacción del usuario actual (pone/quita). */
  alternarReaccion(publicacion_id: string, tipo: string): Promise<void>;
  fijar(publicacion_id: string, fijada: boolean): Promise<void>;
  listarUsuarios(): Promise<Usuario[]>;
}

// ===============================================================
// MOCK
// ===============================================================

function pub(
  id: string,
  autor_id: string,
  tipo: Publicacion["tipo"],
  titulo: string | null,
  cuerpo: string,
  hace: number,
  extra: Partial<Publicacion> = {},
): Publicacion {
  return {
    id,
    autor_id,
    tipo,
    titulo,
    cuerpo,
    imagenes: [],
    evento_fecha: null,
    evento_lugar: null,
    importante: tipo === "importante",
    fijada: false,
    activo: true,
    eliminado_en: null,
    creado_en: tsRel(hace, 9),
    ...extra,
  };
}

const PUBLICACIONES: Publicacion[] = [
  pub(
    "pb-01",
    "u-01",
    "importante",
    "Resumen Comité Operativo — semana " + "27",
    "Puntos clave de hoy:\n" +
      "• Entregas: 5 esta semana, 2 con instalación (hotel Dann y SmartFit).\n" +
      "• Producción: 3 racks entran a Corte el lunes; falta confirmar tubería (SC-011).\n" +
      "• Garantía GR-0009 (soporte de pared) tiene prioridad: se repinta esta semana.\n" +
      "• Meta de la semana: cero pedidos vencidos. Vamos 1 en rojo (OP-1051), pendiente saldo.\n" +
      "Gracias a todos por el empuje. 💪",
    -1,
    { fijada: true },
  ),
  pub(
    "pb-02",
    "u-02",
    "noticia",
    "¡Nuevo cliente grande!",
    "Cerramos la dotación completa del gimnasio de la Torre Empresarial GNB (Bogotá). " +
      "Es el pedido B2B más grande del trimestre. Felicitaciones al equipo comercial.",
    -2,
  ),
  pub(
    "pb-03",
    "u-01",
    "evento",
    "Almuerzo de integración de fin de mes",
    "Nos reunimos todos para cerrar el mes. Habrá asado. ¡No falten!",
    -3,
    {
      evento_fecha: tsRel(9, 12),
      evento_lugar: "Planta — zona de despachos",
    },
  ),
  pub(
    "pb-04",
    "u-03",
    "importante",
    "Recordatorio de seguridad en planta",
    "Por favor usar SIEMPRE gafas y guantes en la zona de corte y soldadura. " +
      "Tuvimos un casi-accidente esta semana. La seguridad es de todos.",
    -5,
  ),
  pub(
    "pb-05",
    "u-02",
    "noticia",
    null,
    "Ya está publicado el nuevo catálogo de racks en la web. Compártanlo con los clientes. 🚀",
    -8,
  ),
];

const COMENTARIOS: PublicacionComentario[] = [
  { id: "cm-01", publicacion_id: "pb-01", autor_id: "u-04", cuerpo: "Confirmado, la tubería llega el martes. Ya hablé con Aceros del Valle.", imagen_url: null, activo: true, creado_en: tsRel(-1, 11) },
  { id: "cm-02", publicacion_id: "pb-01", autor_id: "u-03", cuerpo: "Yo me encargo del saldo de OP-1051 con el cliente hoy mismo.", imagen_url: null, activo: true, creado_en: tsRel(-1, 14) },
  { id: "cm-03", publicacion_id: "pb-02", autor_id: "u-01", cuerpo: "¡Excelente María! Gran trabajo.", imagen_url: null, activo: true, creado_en: tsRel(-2, 10) },
  { id: "cm-04", publicacion_id: "pb-04", autor_id: "u-05", cuerpo: "De acuerdo. Ya revisamos que todos tengan su dotación completa.", imagen_url: null, activo: true, creado_en: tsRel(-5, 16) },
];

const REACCIONES_SEED: PublicacionReaccion[] = [
  { publicacion_id: "pb-01", usuario_id: "u-02", tipo: "like", en: tsRel(-1, 10) },
  { publicacion_id: "pb-01", usuario_id: "u-03", tipo: "like", en: tsRel(-1, 10) },
  { publicacion_id: "pb-01", usuario_id: "u-04", tipo: "celebra", en: tsRel(-1, 12) },
  { publicacion_id: "pb-02", usuario_id: "u-01", tipo: "celebra", en: tsRel(-2, 9) },
  { publicacion_id: "pb-02", usuario_id: "u-03", tipo: "celebra", en: tsRel(-2, 9) },
  { publicacion_id: "pb-02", usuario_id: "u-04", tipo: "like", en: tsRel(-2, 9) },
  { publicacion_id: "pb-03", usuario_id: "u-05", tipo: "like", en: tsRel(-3, 10) },
  { publicacion_id: "pb-04", usuario_id: "u-01", tipo: "importante", en: tsRel(-5, 11) },
];

interface CarteleraStore {
  publicaciones: Publicacion[];
  comentarios: PublicacionComentario[];
  reacciones: PublicacionReaccion[];
}

const g = globalThis as unknown as {
  __carteleraStore?: CarteleraStore;
  __carteleraRepositorio?: CarteleraRepository;
};

function getStore(): CarteleraStore {
  g.__carteleraStore ??= {
    publicaciones: structuredClone(PUBLICACIONES),
    comentarios: structuredClone(COMENTARIOS),
    reacciones: structuredClone(REACCIONES_SEED),
  };
  return g.__carteleraStore;
}

export class MockCarteleraRepository implements CarteleraRepository {
  private get store() {
    return getStore();
  }

  private card(p: Publicacion): PublicacionCard {
    const reacciones = this.store.reacciones.filter((r) => r.publicacion_id === p.id);
    const conteo: Record<string, number> = {};
    for (const r of reacciones) conteo[r.tipo] = (conteo[r.tipo] ?? 0) + 1;
    return {
      publicacion: structuredClone(p),
      autor: USUARIOS.find((u) => u.id === p.autor_id)!,
      comentarios: this.store.comentarios
        .filter((c) => c.publicacion_id === p.id && c.activo)
        .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
        .map((c) => ({
          comentario: structuredClone(c),
          autor: USUARIOS.find((u) => u.id === c.autor_id) ?? USUARIOS[0],
        })),
      reacciones: conteo,
      misReacciones: reacciones
        .filter((r) => r.usuario_id === USUARIO_ACTUAL)
        .map((r) => r.tipo),
    };
  }

  async listar(
    filtros: { tipo?: Publicacion["tipo"]; texto?: string } = {},
  ): Promise<PublicacionCard[]> {
    const q = filtros.texto?.trim().toLowerCase();
    return this.store.publicaciones
      .filter((p) => p.activo)
      .filter((p) => !filtros.tipo || p.tipo === filtros.tipo)
      .filter((p) => {
        if (!q) return true;
        return `${p.titulo ?? ""} ${p.cuerpo}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // fijadas primero, luego por fecha desc
        if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
        return b.creado_en.localeCompare(a.creado_en);
      })
      .map((p) => this.card(p));
  }

  async publicar(input: NuevaPublicacion): Promise<Publicacion> {
    if (!input.cuerpo.trim()) throw new Error("Escribe el contenido de la publicación");
    if (input.tipo === "evento" && !input.evento_fecha) {
      throw new Error("Un evento necesita fecha");
    }
    const p: Publicacion = {
      id: `pb-${crypto.randomUUID().slice(0, 8)}`,
      autor_id: USUARIO_ACTUAL,
      tipo: input.tipo,
      titulo: input.titulo?.trim() || null,
      cuerpo: input.cuerpo.trim(),
      imagenes: input.imagenes,
      evento_fecha: input.evento_fecha,
      evento_lugar: input.evento_lugar?.trim() || null,
      importante: input.tipo === "importante",
      fijada: input.fijada,
      activo: true,
      eliminado_en: null,
      creado_en: new Date().toISOString(),
    };
    this.store.publicaciones.push(p);
    return structuredClone(p);
  }

  async comentar(input: {
    publicacion_id: string;
    cuerpo: string;
    imagen_url: string | null;
  }): Promise<PublicacionComentario> {
    if (!input.cuerpo.trim() && !input.imagen_url) {
      throw new Error("Escribe un comentario o adjunta una imagen");
    }
    if (!this.store.publicaciones.some((p) => p.id === input.publicacion_id)) {
      throw new Error("La publicación no existe");
    }
    const c: PublicacionComentario = {
      id: `cm-${crypto.randomUUID().slice(0, 8)}`,
      publicacion_id: input.publicacion_id,
      autor_id: USUARIO_ACTUAL,
      cuerpo: input.cuerpo.trim(),
      imagen_url: input.imagen_url,
      activo: true,
      creado_en: new Date().toISOString(),
    };
    this.store.comentarios.push(c);
    return structuredClone(c);
  }

  async alternarReaccion(publicacion_id: string, tipo: string): Promise<void> {
    const i = this.store.reacciones.findIndex(
      (r) =>
        r.publicacion_id === publicacion_id &&
        r.usuario_id === USUARIO_ACTUAL &&
        r.tipo === tipo,
    );
    if (i >= 0) {
      this.store.reacciones.splice(i, 1); // quitar
    } else {
      this.store.reacciones.push({
        publicacion_id,
        usuario_id: USUARIO_ACTUAL,
        tipo,
        en: new Date().toISOString(),
      });
    }
  }

  async fijar(publicacion_id: string, fijada: boolean): Promise<void> {
    const p = this.store.publicaciones.find((x) => x.id === publicacion_id);
    if (!p) throw new Error("Publicación no encontrada");
    p.fijada = fijada;
  }

  async listarUsuarios(): Promise<Usuario[]> {
    return [...USUARIOS];
  }
}

export function getCarteleraRepository(): CarteleraRepository {
  g.__carteleraRepositorio ??= new MockCarteleraRepository();
  return g.__carteleraRepositorio;
}
