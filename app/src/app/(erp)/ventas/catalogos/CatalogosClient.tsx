"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileText,
  History,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import {
  CATEGORIAS_CATALOGO,
  type CatalogoCard,
  type VersionConAutor,
} from "@/lib/data/catalogos";
import { formatFechaCorta } from "@/lib/formato";
import { crearCatalogoAction, subirVersionAction } from "./actions";

interface Props {
  catalogos: CatalogoCard[];
  puedeEditar: boolean;
}

interface ArchivoLeido {
  archivo_url: string;
  archivo_nombre: string;
  tamano_bytes: number;
}

function tamano(bytes: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Lee un PDF como data URL (mock); en prod se subiría a Storage. */
function leerPdf(file: File): Promise<ArchivoLeido> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () =>
      res({ archivo_url: String(fr.result), archivo_nombre: file.name, tamano_bytes: file.size });
    fr.onerror = () => rej(new Error("No se pudo leer el archivo."));
    fr.readAsDataURL(file);
  });
}

/** data: URL → blob URL (Chrome bloquea navegar a data:). */
function aBlobUrl(dataUrl: string): string {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? "application/pdf";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function abrirPdf(dataUrl: string) {
  window.open(aBlobUrl(dataUrl), "_blank", "noopener");
}

function descargarPdf(v: VersionConAutor) {
  const a = document.createElement("a");
  a.href = aBlobUrl(v.archivo_url);
  a.download = v.archivo_nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function CatalogosClient({ catalogos, puedeEditar }: Props) {
  const router = useRouter();
  const [modalNuevo, setModalNuevo] = useState(false);
  const [historial, setHistorial] = useState<string | null>(null);
  const [subiendoEn, setSubiendoEn] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Catálogos</h1>
          <p className="text-[12.5px] text-neutro">
            La versión actual de cada catálogo, siempre disponible para el equipo comercial.
          </p>
        </div>
        {puedeEditar && (
          <button
            onClick={() => setModalNuevo(true)}
            className="flex items-center gap-1.5 rounded-pill bg-carbon px-4 py-2 text-[13px] font-semibold text-white hover:bg-carbon/90"
          >
            <Plus size={16} /> Nuevo catálogo
          </button>
        )}
      </div>

      {catalogos.length === 0 ? (
        <p className="rounded-card border border-borde bg-card p-6 text-center text-[13px] text-neutro">
          Aún no hay catálogos. {puedeEditar && "Crea el primero con “Nuevo catálogo”."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalogos.map((c) => (
            <TarjetaCatalogo
              key={c.catalogo.id}
              card={c}
              puedeEditar={puedeEditar}
              historialAbierto={historial === c.catalogo.id}
              onToggleHistorial={() =>
                setHistorial((prev) => (prev === c.catalogo.id ? null : c.catalogo.id))
              }
              subiendo={subiendoEn === c.catalogo.id}
              onSubir={() =>
                setSubiendoEn((prev) => (prev === c.catalogo.id ? null : c.catalogo.id))
              }
              onListo={() => {
                setSubiendoEn(null);
                router.refresh();
              }}
            />
          ))}
        </div>
      )}

      {modalNuevo && (
        <ModalNuevo
          onCerrar={() => setModalNuevo(false)}
          onCreado={() => {
            setModalNuevo(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Tarjeta de catálogo
// ---------------------------------------------------------------

function TarjetaCatalogo({
  card,
  puedeEditar,
  historialAbierto,
  onToggleHistorial,
  subiendo,
  onSubir,
  onListo,
}: {
  card: CatalogoCard;
  puedeEditar: boolean;
  historialAbierto: boolean;
  onToggleHistorial: () => void;
  subiendo: boolean;
  onSubir: () => void;
  onListo: () => void;
}) {
  const { catalogo, actual, total_versiones } = card;

  return (
    <div className="flex flex-col rounded-card border border-borde bg-card">
      <div className="flex-1 p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          {catalogo.categoria && (
            <span className="rounded-pill bg-dorado-suave px-2.5 py-0.5 text-[11px] font-bold text-dorado-oscuro">
              {catalogo.categoria}
            </span>
          )}
          <span className="text-[11px] font-semibold text-neutro">
            {total_versiones} {total_versiones === 1 ? "versión" : "versiones"}
          </span>
        </div>
        <h2 className="text-[16px] font-bold leading-tight text-carbon">{catalogo.nombre}</h2>
        {catalogo.descripcion && (
          <p className="mt-1 text-[12.5px] leading-snug text-neutro">{catalogo.descripcion}</p>
        )}

        {/* Versión actual */}
        {actual ? (
          <div className="mt-4 rounded-lg border border-dorado bg-dorado-suave/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-dorado-oscuro">
                Versión actual
              </span>
              <span className="rounded-pill bg-carbon px-2 py-0.5 text-[11px] font-bold text-white">
                v{actual.version}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-neutro">
              {formatFechaCorta(new Date(actual.subido_en))} · {actual.autor?.nombre ?? "—"} ·{" "}
              {tamano(actual.tamano_bytes)}
            </p>
            {actual.notas && <p className="mt-1 text-[12px] italic text-neutro">“{actual.notas}”</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => abrirPdf(actual.archivo_url)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-carbon px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-carbon/90"
              >
                <FileText size={15} /> Abrir PDF
              </button>
              <button
                onClick={() => descargarPdf(actual)}
                aria-label="Descargar"
                title="Descargar"
                className="flex items-center justify-center rounded-lg border border-borde bg-white px-3 py-2 text-carbon hover:bg-sutil"
              >
                <Download size={15} />
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-[12.5px] text-neutro">Sin versiones cargadas.</p>
        )}
      </div>

      {/* Pie: historial + subir versión */}
      <div className="border-t border-borde px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {total_versiones > 1 ? (
            <button
              onClick={onToggleHistorial}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-azul hover:underline"
            >
              <History size={14} /> Historial ({total_versiones})
            </button>
          ) : (
            <span className="text-[12px] text-neutro">Sin versiones anteriores</span>
          )}
          {puedeEditar && (
            <button
              onClick={onSubir}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-dorado-oscuro hover:underline"
            >
              <Upload size={14} /> Subir versión
            </button>
          )}
        </div>

        {historialAbierto && (
          <ul className="mt-3 space-y-2 border-t border-borde pt-3">
            {/* obtener historial requiere el detalle; aquí mostramos lo que hay */}
            <HistorialInline catalogoId={catalogo.id} actual={actual} />
          </ul>
        )}

        {subiendo && puedeEditar && (
          <FormSubir catalogoId={catalogo.id} onListo={onListo} onCancelar={onSubir} />
        )}
      </div>
    </div>
  );
}

/**
 * El listar() solo trae la versión actual por tarjeta. Para el historial
 * completo pedimos el detalle bajo demanda al abrir.
 */
function HistorialInline({
  catalogoId,
  actual,
}: {
  catalogoId: string;
  actual: VersionConAutor | null;
}) {
  const [versiones, setVersiones] = useState<VersionConAutor[] | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/catalogos/${catalogoId}`)
      .then((r) => r.json())
      .then((d) => vivo && setVersiones(d.versiones ?? (actual ? [actual] : [])))
      .catch(() => vivo && setVersiones(actual ? [actual] : []));
    return () => {
      vivo = false;
    };
  }, [catalogoId, actual]);

  if (versiones === null) {
    return (
      <li className="flex items-center gap-2 text-[12px] text-neutro">
        <Loader2 size={13} className="animate-spin" /> Cargando historial…
      </li>
    );
  }

  return (
    <>
      {versiones.map((v) => (
        <li key={v.id} className="flex items-start justify-between gap-2 text-[12px]">
          <div className="min-w-0">
            <span className="font-semibold">v{v.version}</span>{" "}
            <span className="text-neutro">
              · {formatFechaCorta(new Date(v.subido_en))} · {v.autor?.nombre ?? "—"}
            </span>
            {v.notas && <p className="truncate italic text-neutro">“{v.notas}”</p>}
          </div>
          <button
            onClick={() => abrirPdf(v.archivo_url)}
            className="shrink-0 font-semibold text-azul hover:underline"
          >
            Abrir
          </button>
        </li>
      ))}
    </>
  );
}

// ---------------------------------------------------------------
// Formulario: subir nueva versión
// ---------------------------------------------------------------

function FormSubir({
  catalogoId,
  onListo,
  onCancelar,
}: {
  catalogoId: string;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null);
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf") return setError("El archivo debe ser un PDF.");
    setArchivo(await leerPdf(f));
  }

  async function guardar() {
    if (!archivo) return setError("Selecciona un PDF.");
    setPendiente(true);
    setError(null);
    const res = await subirVersionAction(catalogoId, { ...archivo, notas: notas.trim() || null });
    setPendiente(false);
    if (res.ok) onListo();
    else setError(res.error);
  }

  return (
    <div className="mt-3 space-y-2 border-t border-borde pt-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="block w-full text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-sutil file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-carbon"
      />
      <input
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        placeholder="Nota del cambio (opcional)"
        className="w-full rounded-md border border-borde px-2.5 py-1.5 text-[12.5px] outline-none focus:border-dorado-claro"
      />
      {error && <p className="text-[12px] text-rojo">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={guardar}
          disabled={pendiente || !archivo}
          className="flex items-center gap-1.5 rounded-md bg-carbon px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40"
        >
          {pendiente && <Loader2 size={13} className="animate-spin" />} Guardar versión
        </button>
        <button
          onClick={onCancelar}
          className="rounded-md border border-borde px-3 py-1.5 text-[12.5px] font-semibold text-carbon hover:bg-sutil"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Modal: nuevo catálogo
// ---------------------------------------------------------------

function ModalNuevo({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null);
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  async function onFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (f.type !== "application/pdf") return setError("El archivo debe ser un PDF.");
    setArchivo(await leerPdf(f));
  }

  async function crear() {
    if (!nombre.trim()) return setError("Ponle un nombre al catálogo.");
    if (!archivo) return setError("Sube el PDF de la primera versión.");
    setPendiente(true);
    setError(null);
    const res = await crearCatalogoAction({
      nombre: nombre.trim(),
      categoria: categoria.trim() || null,
      descripcion: descripcion.trim() || null,
      primeraVersion: { ...archivo, notas: notas.trim() || null },
    });
    setPendiente(false);
    if (res.ok) onCreado();
    else setError(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Nuevo catálogo</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="text-neutro hover:text-carbon">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2.5">
          <Campo label="Nombre">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Catálogo general 2026"
              className="w-full rounded-md border border-borde px-2.5 py-1.5 text-[13px] outline-none focus:border-dorado-claro"
            />
          </Campo>
          <Campo label="Categoría">
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              list="categorias-catalogo"
              placeholder="General"
              className="w-full rounded-md border border-borde px-2.5 py-1.5 text-[13px] outline-none focus:border-dorado-claro"
            />
            <datalist id="categorias-catalogo">
              {CATEGORIAS_CATALOGO.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Descripción">
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Para qué sirve este catálogo…"
              className="w-full resize-none rounded-md border border-borde px-2.5 py-1.5 text-[13px] outline-none focus:border-dorado-claro"
            />
          </Campo>
          <Campo label="Archivo PDF (primera versión)">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-[12px] file:mr-2 file:rounded-md file:border-0 file:bg-sutil file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-carbon"
            />
          </Campo>
          <Campo label="Nota (opcional)">
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Versión inicial"
              className="w-full rounded-md border border-borde px-2.5 py-1.5 text-[13px] outline-none focus:border-dorado-claro"
            />
          </Campo>
          {error && <p className="text-[12.5px] text-rojo">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCerrar}
            className="rounded-md border border-borde px-4 py-1.5 text-[13px] font-semibold text-carbon hover:bg-sutil"
          >
            Cancelar
          </button>
          <button
            onClick={crear}
            disabled={pendiente}
            className="flex items-center gap-1.5 rounded-md bg-carbon px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {pendiente && <Loader2 size={14} className="animate-spin" />} Crear catálogo
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-bold text-neutro">{label}</span>
      {children}
    </label>
  );
}
