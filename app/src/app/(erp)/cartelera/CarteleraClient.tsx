"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { REACCIONES, type PublicacionCard } from "@/lib/data/cartelera";
import { formatFechaHora } from "@/lib/formato";
import type { Publicacion } from "@/lib/types/db";
import { alternarReaccion, comentar, fijar, publicar } from "./actions";

interface Props {
  publicaciones: PublicacionCard[];
}

const TIPO_META: Record<Publicacion["tipo"], { label: string; badge: string; emoji: string }> = {
  noticia: { label: "Noticia", badge: "bg-azul-bg text-azul", emoji: "📣" },
  evento: { label: "Evento", badge: "bg-dorado-suave text-dorado-oscuro", emoji: "📅" },
  importante: { label: "Importante", badge: "bg-rojo-bg text-rojo", emoji: "⚠️" },
};

const inputCls =
  "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

/** Lee un File como data URL (mock de subida a Storage). */
function leerImagen(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function iniciales(n: string) {
  return n.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function CarteleraClient({ publicaciones }: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Publicacion["tipo"] | "todas">("todas");
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState<string | null>(null);

  // fecha relevante para filtrar: la del evento si lo es, si no la de publicación
  const fechaRelevante = (p: PublicacionCard) =>
    (p.publicacion.evento_fecha ?? p.publicacion.creado_en).slice(0, 10);

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase();
    return publicaciones.filter((p) => {
      if (filtro !== "todas" && p.publicacion.tipo !== filtro) return false;
      const f = fechaRelevante(p);
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      if (q) {
        const blob = [
          p.publicacion.titulo ?? "",
          p.publicacion.cuerpo,
          p.autor.nombre,
        ]
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [publicaciones, filtro, texto, desde, hasta]);

  const hayFiltroFecha = desde || hasta || texto;

  /** Atajo: fija desde/hasta al mes calendario indicado (offset desde hoy). */
  function mesRelativo(offset: number) {
    const base = new Date();
    base.setMonth(base.getMonth() + offset, 1);
    const y = base.getFullYear();
    const m = base.getMonth();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setDesde(iso(new Date(y, m, 1)));
    setHasta(iso(new Date(y, m + 1, 0)));
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-4">
        <p className="text-[12.5px] text-neutro">Comunicación interna</p>
        <h1 className="text-[26px] font-extrabold tracking-tight">Cartelera</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-rojo/30 bg-rojo-bg px-4 py-3 text-[13px] font-semibold text-rojo">
          {error}
        </div>
      )}

      <Compositor onListo={() => router.refresh()} onError={setError} />

      {/* Filtro por tipo */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["todas", "noticia", "evento", "importante"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFiltro(t)}
            className={`rounded-pill border px-4 py-1.5 text-[12.5px] font-bold capitalize ${
              filtro === t
                ? "border-carbon bg-carbon text-white"
                : "border-borde bg-card text-neutro hover:border-dorado"
            }`}
          >
            {t === "todas" ? "Todas" : TIPO_META[t].label}
          </button>
        ))}
      </div>

      {/* Búsqueda + rango de fechas */}
      <div className="mb-4 flex flex-wrap items-end gap-2.5 rounded-card border border-borde bg-card px-3.5 py-3">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar (ej: comité, seguridad…)"
          className="min-w-[180px] flex-1 rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <label className="flex flex-col gap-1 text-[10.5px] font-bold text-neutro">
          DESDE
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10.5px] font-bold text-neutro">
          HASTA
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
          />
        </label>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => mesRelativo(0)}
            className="rounded-pill border border-borde px-3 py-2 text-[12px] font-semibold hover:border-dorado"
          >
            Este mes
          </button>
          <button
            type="button"
            onClick={() => mesRelativo(-1)}
            className="rounded-pill border border-borde px-3 py-2 text-[12px] font-semibold hover:border-dorado"
          >
            Mes pasado
          </button>
          {hayFiltroFecha && (
            <button
              type="button"
              onClick={() => {
                setTexto("");
                setDesde("");
                setHasta("");
              }}
              className="rounded-pill border border-borde px-3 py-2 text-[12px] font-semibold text-neutro hover:border-neutro"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="mb-3 text-[12.5px] text-neutro">
        <b className="text-carbon">{filtradas.length}</b>{" "}
        {filtradas.length === 1 ? "publicación" : "publicaciones"}
        {(desde || hasta) && (
          <>
            {" "}
            entre <b className="text-carbon">{desde || "el inicio"}</b> y{" "}
            <b className="text-carbon">{hasta || "hoy"}</b>
          </>
        )}
      </div>

      <div className="space-y-4">
        {filtradas.map((p) => (
          <TarjetaPublicacion
            key={p.publicacion.id}
            card={p}
            onRefrescar={() => router.refresh()}
            onError={setError}
          />
        ))}
        {filtradas.length === 0 && (
          <p className="rounded-card border border-borde bg-card px-4 py-10 text-center text-neutro">
            No hay publicaciones con estos filtros.
          </p>
        )}
      </div>
    </div>
  );
}

/** Compositor: crear noticia / evento / información importante + imágenes. */
function Compositor({
  onListo,
  onError,
}: {
  onListo: () => void;
  onError: (e: string | null) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<Publicacion["tipo"]>("noticia");
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [eventoFecha, setEventoFecha] = useState("");
  const [eventoLugar, setEventoLugar] = useState("");
  const [fijada, setFijada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTipo("noticia");
    setTitulo("");
    setCuerpo("");
    setImagenes([]);
    setEventoFecha("");
    setEventoLugar("");
    setFijada(false);
  }

  async function agregarImagenes(files: FileList | null) {
    if (!files) return;
    const urls = await Promise.all(Array.from(files).map(leerImagen));
    setImagenes((xs) => [...xs, ...urls]);
  }

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await publicar({
      tipo,
      titulo: titulo.trim() || null,
      cuerpo,
      imagenes,
      evento_fecha: tipo === "evento" && eventoFecha ? new Date(eventoFecha).toISOString() : null,
      evento_lugar: tipo === "evento" ? eventoLugar : null,
      fijada,
    });
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    reset();
    setAbierto(false);
    onListo();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mb-4 w-full rounded-card border border-borde bg-card px-4 py-3 text-left text-[14px] text-neutro hover:border-dorado"
      >
        Comparte una noticia, un evento o información importante…
      </button>
    );
  }

  return (
    <div className="mb-4 rounded-card border border-borde bg-card p-4">
      <div className="mb-3 flex gap-1.5">
        {(Object.keys(TIPO_META) as Publicacion["tipo"][]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-bold ${
              tipo === t
                ? "border-carbon bg-carbon text-white"
                : "border-borde bg-card text-neutro hover:border-dorado"
            }`}
          >
            {TIPO_META[t].emoji} {TIPO_META[t].label}
          </button>
        ))}
      </div>
      <input
        className={`${inputCls} mb-2 w-full font-semibold`}
        placeholder="Título (opcional)"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
      />
      <textarea
        rows={tipo === "importante" ? 5 : 3}
        className={`${inputCls} w-full`}
        placeholder={
          tipo === "importante"
            ? "Ej: Resumen del Comité Operativo de esta semana…"
            : "¿Qué quieres compartir con el equipo?"
        }
        value={cuerpo}
        onChange={(e) => setCuerpo(e.target.value)}
      />
      {tipo === "evento" && (
        <div className="mt-2 flex flex-wrap gap-2.5">
          <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
            FECHA Y HORA
            <input
              type="datetime-local"
              className={inputCls}
              value={eventoFecha}
              onChange={(e) => setEventoFecha(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-[11px] font-bold text-neutro">
            LUGAR
            <input
              className={inputCls}
              placeholder="Ej: Planta — zona de despachos"
              value={eventoLugar}
              onChange={(e) => setEventoLugar(e.target.value)}
            />
          </label>
        </div>
      )}

      {imagenes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {imagenes.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-20 w-20 rounded-[8px] object-cover" />
              <button
                type="button"
                onClick={() => setImagenes((xs) => xs.filter((_, k) => k !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-carbon text-[12px] text-white"
                aria-label="Quitar imagen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void agregarImagenes(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-pill border border-borde px-3.5 py-1.5 text-[12.5px] font-semibold hover:border-dorado"
        >
          🖼 Imagen
        </button>
        <label className="flex items-center gap-1.5 text-[12.5px]">
          <input type="checkbox" checked={fijada} onChange={(e) => setFijada(e.target.checked)} />
          Fijar arriba
        </label>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setAbierto(false);
            }}
            className="rounded-pill border border-borde px-4 py-2 text-[12.5px] font-semibold hover:border-neutro"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || !cuerpo.trim()}
            onClick={() => void guardar()}
            className="rounded-pill bg-carbon px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {guardando ? "Publicando…" : "Publicar"}
          </button>
        </span>
      </div>
    </div>
  );
}

function TarjetaPublicacion({
  card,
  onRefrescar,
  onError,
}: {
  card: PublicacionCard;
  onRefrescar: () => void;
  onError: (e: string | null) => void;
}) {
  const p = card.publicacion;
  const meta = TIPO_META[p.tipo];
  const [comentando, setComentando] = useState(false);

  async function reaccionar(tipo: string) {
    onError(null);
    const r = await alternarReaccion(p.id, tipo);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onRefrescar();
  }

  async function alternarFijar() {
    await fijar(p.id, !p.fijada);
    onRefrescar();
  }

  const totalReacciones = Object.values(card.reacciones).reduce((a, b) => a + b, 0);

  return (
    <article
      className={`rounded-card border bg-card p-5 ${
        p.importante ? "border-rojo/30" : "border-borde"
      } ${p.fijada ? "ring-1 ring-dorado-claro" : ""}`}
    >
      {/* cabecera */}
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dorado-suave text-[13px] font-extrabold text-dorado-oscuro">
          {iniciales(card.autor.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[13.5px]">{card.autor.nombre}</b>
            <span className={`rounded-pill px-2 py-0.5 text-[10.5px] font-bold ${meta.badge}`}>
              {meta.emoji} {meta.label}
            </span>
            {p.fijada && (
              <span className="rounded-pill bg-dorado-suave px-2 py-0.5 text-[10.5px] font-bold text-dorado-oscuro">
                📌 Fijada
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-neutro">{formatFechaHora(new Date(p.creado_en))}</p>
        </div>
        <button
          type="button"
          onClick={() => void alternarFijar()}
          title={p.fijada ? "Quitar de fijadas" : "Fijar arriba"}
          className="text-[15px] opacity-50 hover:opacity-100"
        >
          📌
        </button>
      </div>

      {/* contenido */}
      {p.titulo && <h2 className="mt-3 text-[17px] font-extrabold tracking-tight">{p.titulo}</h2>}
      {p.tipo === "evento" && p.evento_fecha && (
        <p className="mt-1 text-[13px] font-semibold text-dorado-oscuro">
          🗓 {formatFechaHora(new Date(p.evento_fecha))}
          {p.evento_lugar && ` · ${p.evento_lugar}`}
        </p>
      )}
      <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed">{p.cuerpo}</p>

      {p.imagenes.length > 0 && (
        <div className={`mt-3 grid gap-2 ${p.imagenes.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {p.imagenes.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="max-h-[320px] w-full rounded-[10px] object-cover" />
          ))}
        </div>
      )}

      {/* reacciones */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-borde pt-3">
        {REACCIONES.map((r) => {
          const activa = card.misReacciones.includes(r.tipo);
          const n = card.reacciones[r.tipo] ?? 0;
          return (
            <button
              key={r.tipo}
              type="button"
              onClick={() => void reaccionar(r.tipo)}
              title={r.nombre}
              className={`rounded-pill border px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
                activa
                  ? "border-dorado bg-dorado-suave text-dorado-oscuro"
                  : "border-borde bg-card text-neutro hover:border-dorado"
              }`}
            >
              {r.emoji} {n > 0 && n}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setComentando((v) => !v)}
          className="ml-auto rounded-pill border border-borde px-3 py-1 text-[12.5px] font-semibold text-neutro hover:border-dorado"
        >
          💬 {card.comentarios.length > 0 ? card.comentarios.length : ""} Comentar
        </button>
      </div>

      {/* comentarios */}
      {(card.comentarios.length > 0 || comentando) && (
        <div className="mt-3 space-y-3 border-t border-borde pt-3">
          {card.comentarios.map((c) => (
            <div key={c.comentario.id} className="flex gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutro-bg text-[11px] font-bold text-neutro">
                {iniciales(c.autor.nombre)}
              </span>
              <div className="min-w-0 flex-1 rounded-[10px] bg-sutil px-3 py-2">
                <p className="text-[12.5px]">
                  <b>{c.autor.nombre}</b>{" "}
                  <span className="text-[11px] text-neutro">
                    {formatFechaHora(new Date(c.comentario.creado_en))}
                  </span>
                </p>
                {c.comentario.cuerpo && (
                  <p className="mt-0.5 whitespace-pre-line text-[13px]">{c.comentario.cuerpo}</p>
                )}
                {c.comentario.imagen_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.comentario.imagen_url}
                    alt=""
                    className="mt-2 max-h-[200px] rounded-[8px] object-cover"
                  />
                )}
              </div>
            </div>
          ))}
          <FormComentario
            publicacionId={p.id}
            onListo={onRefrescar}
            onError={onError}
          />
        </div>
      )}
    </article>
  );
}

function FormComentario({
  publicacionId,
  onListo,
  onError,
}: {
  publicacionId: string;
  onListo: () => void;
  onError: (e: string | null) => void;
}) {
  const [cuerpo, setCuerpo] = useState("");
  const [imagen, setImagen] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await comentar({ publicacion_id: publicacionId, cuerpo, imagen_url: imagen });
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    setCuerpo("");
    setImagen(null);
    onListo();
  }

  return (
    <div className="flex gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dorado-suave text-[11px] font-bold text-dorado-oscuro">
        {iniciales("Yo")}
      </span>
      <div className="flex-1">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            className={`${inputCls} flex-1 resize-none`}
            placeholder="Escribe un comentario…"
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void leerImagen(f).then(setImagen);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-pill border border-borde px-3 py-2 text-[13px] hover:border-dorado"
            title="Adjuntar imagen"
          >
            🖼
          </button>
          <button
            type="button"
            disabled={guardando || (!cuerpo.trim() && !imagen)}
            onClick={() => void guardar()}
            className="rounded-pill bg-carbon px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
        {imagen && (
          <div className="relative mt-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagen} alt="" className="h-16 w-16 rounded-[8px] object-cover" />
            <button
              type="button"
              onClick={() => setImagen(null)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-carbon text-[11px] text-white"
              aria-label="Quitar imagen"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
