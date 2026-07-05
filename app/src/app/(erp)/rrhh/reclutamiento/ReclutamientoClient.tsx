"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VacanteCard } from "@/lib/data/rrhh";
import { formatFechaCorta } from "@/lib/formato";
import { parseISO } from "@/lib/vacaciones-logic";
import type { Aplicacion, Vacante } from "@/lib/types/db";
import { agregarAplicacion, crearVacante, moverAplicacion } from "./actions";

interface Props {
  vacantes: VacanteCard[];
}

const ETAPAS: { clave: Aplicacion["etapa"]; nombre: string; tono: string }[] = [
  { clave: "aplico", nombre: "Aplicó", tono: "bg-kanban" },
  { clave: "entrevista", nombre: "Entrevista", tono: "bg-kanban" },
  { clave: "finalista", nombre: "Finalista", tono: "bg-dorado-suave" },
  { clave: "contratado", nombre: "Contratado", tono: "bg-verde-bg/70" },
  { clave: "descartado", nombre: "Descartado", tono: "bg-rojo-bg/60" },
];

const ESTADO_VACANTE: Record<Vacante["estado"], string> = {
  abierta: "bg-verde-bg text-verde",
  pausada: "bg-aviso text-aviso-texto ring-1 ring-aviso-borde",
  cerrada: "bg-neutro-bg text-neutro",
};

const inputCls =
  "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

/**
 * Reclutamiento: cada vacante tiene su embudo Aplicó → Entrevista →
 * Finalista → Contratado / Descartado con arrastrar y soltar. Las
 * cerradas se colapsan al final.
 */
export function ReclutamientoClient({ vacantes }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const abiertas = vacantes.filter((v) => v.vacante.estado !== "cerrada");
  const cerradas = vacantes.filter((v) => v.vacante.estado === "cerrada");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">RRHH /</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">Reclutamiento</h1>
          <p className="mt-0.5 text-[12.5px] text-neutro">
            Un embudo por vacante · arrastra las fichas entre etapas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreando((v) => !v)}
          className="rounded-pill bg-carbon px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-black"
        >
          {creando ? "Cerrar formulario" : "+ Nueva vacante"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-rojo/30 bg-rojo-bg px-4 py-3 text-[13px] font-semibold text-rojo">
          {error}
        </div>
      )}

      {creando && (
        <FormVacante
          onListo={() => {
            setCreando(false);
            router.refresh();
          }}
          onError={setError}
        />
      )}

      <div className="space-y-6">
        {abiertas.map((v) => (
          <BloqueVacante
            key={v.vacante.id}
            card={v}
            onError={setError}
            onRefrescar={() => router.refresh()}
          />
        ))}
      </div>

      {cerradas.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-[13px] font-bold text-neutro">
            Vacantes cerradas ({cerradas.length})
          </summary>
          <div className="mt-3 space-y-3">
            {cerradas.map((v) => (
              <div
                key={v.vacante.id}
                className="rounded-card border border-borde bg-sutil px-4 py-3"
              >
                <span className="font-bold">{v.vacante.cargo}</span>
                <span className="ml-2 text-[12px] text-neutro">
                  {v.aplicaciones.filter((a) => a.etapa === "contratado").length}{" "}
                  contratado(s) · {v.aplicaciones.length} aspirantes
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function BloqueVacante({
  card,
  onError,
  onRefrescar,
}: {
  card: VacanteCard;
  onError: (e: string | null) => void;
  onRefrescar: () => void;
}) {
  const [colDestino, setColDestino] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const v = card.vacante;

  async function mover(id: string, etapa: Aplicacion["etapa"]) {
    onError(null);
    const r = await moverAplicacion(id, etapa);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onRefrescar();
  }

  return (
    <div className="rounded-card border border-borde bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h2 className="text-[16px] font-extrabold tracking-tight">{v.cargo}</h2>
        {v.area && (
          <span className="rounded-pill bg-neutro-bg px-2 py-0.5 text-[10.5px] font-bold capitalize text-neutro">
            {v.area}
          </span>
        )}
        <span
          className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold capitalize ${ESTADO_VACANTE[v.estado]}`}
        >
          {v.estado}
        </span>
        {v.publicada_en && (
          <span className="text-[11.5px] text-neutro">
            publicada {formatFechaCorta(parseISO(v.publicada_en))}
          </span>
        )}
        <button
          type="button"
          onClick={() => setAgregando((a) => !a)}
          className="ml-auto rounded-pill border border-borde px-3 py-1.5 text-[12px] font-semibold hover:border-dorado"
        >
          + Aspirante
        </button>
      </div>

      {agregando && (
        <FormAspirante
          vacanteId={v.id}
          onListo={() => {
            setAgregando(false);
            onRefrescar();
          }}
          onError={onError}
        />
      )}

      <div className="-mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {ETAPAS.map((etapa) => {
          const fichas = card.aplicaciones.filter((a) => a.etapa === etapa.clave);
          return (
            <div
              key={etapa.clave}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setColDestino(etapa.clave);
              }}
              onDragLeave={() => setColDestino(null)}
              onDrop={(e) => {
                e.preventDefault();
                setColDestino(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) void mover(id, etapa.clave);
              }}
              className={`flex min-h-[120px] w-[190px] shrink-0 flex-col gap-2 rounded-card p-2.5 transition-shadow ${etapa.tono} ${
                colDestino === etapa.clave ? "ring-2 ring-dorado" : ""
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutro">
                  {etapa.nombre}
                </span>
                <span className="text-[11px] font-semibold text-neutro">
                  {fichas.length}
                </span>
              </div>
              {fichas.map((a) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", a.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-grab rounded-[9px] border border-[#e6e5e1] bg-card p-2.5 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-shadow hover:border-dorado-claro hover:shadow-[0_4px_12px_rgba(0,0,0,.1)] active:cursor-grabbing"
                >
                  <p className="text-[12.5px] font-bold">{a.nombre}</p>
                  {a.contacto && (
                    <p className="mt-0.5 text-[11px] text-neutro">{a.contacto}</p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormAspirante({
  vacanteId,
  onListo,
  onError,
}: {
  vacanteId: string;
  onListo: () => void;
  onError: (e: string | null) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await agregarAplicacion({
      vacante_id: vacanteId,
      nombre,
      contacto: contacto.trim() || null,
    });
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onListo();
  }

  return (
    <div className="mb-3 flex flex-wrap items-end gap-2.5 rounded-[10px] bg-sutil p-3">
      <input
        className={`${inputCls} min-w-[200px] flex-1`}
        placeholder="Nombre del aspirante"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <input
        className={`${inputCls} min-w-[160px]`}
        placeholder="Teléfono o correo"
        value={contacto}
        onChange={(e) => setContacto(e.target.value)}
      />
      <button
        type="button"
        disabled={guardando || !nombre.trim()}
        onClick={() => void guardar()}
        className="rounded-pill bg-carbon px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {guardando ? "Agregando…" : "Agregar"}
      </button>
    </div>
  );
}

function FormVacante({
  onListo,
  onError,
}: {
  onListo: () => void;
  onError: (e: string | null) => void;
}) {
  const [cargo, setCargo] = useState("");
  const [area, setArea] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await crearVacante(cargo, area || null);
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onListo();
  }

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-card border border-borde bg-card p-5">
      <label className="flex flex-1 flex-col gap-1 text-[11px] font-bold text-neutro">
        CARGO *
        <input
          className={`${inputCls} min-w-[220px]`}
          placeholder="Ej: Técnico soldador MIG"
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
        ÁREA
        <select
          className={inputCls}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">Sin definir</option>
          <option value="planta">Planta</option>
          <option value="administración">Administración</option>
        </select>
      </label>
      <button
        type="button"
        disabled={guardando || !cargo.trim()}
        onClick={() => void guardar()}
        className="rounded-pill bg-carbon px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
      >
        {guardando ? "Creando…" : "Crear vacante"}
      </button>
    </div>
  );
}
