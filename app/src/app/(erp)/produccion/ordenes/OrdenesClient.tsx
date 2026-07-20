"use client";

import { useEffect, useMemo, useState } from "react";
import {
  aplicarFiltros,
  esOpArchivada,
  type FiltrosOps,
  type OpCard,
} from "@/lib/data/ops";
import { moverEtapa as moverEtapaAction } from "./actions";
import type { SemaforoOp } from "@/lib/ops-logic";
import type { Ciudad, EtapaProduccion, OrigenOp } from "@/lib/types/db";
import { VistaCalendario } from "./VistaCalendario";
import { VistaKanban } from "./VistaKanban";
import { VistaLista } from "./VistaLista";

export type Vista = "kanban" | "lista" | "calendario";
export type CampoFechaCal = "entrega" | "creacion";

interface Props {
  cardsIniciales: OpCard[];
  etapas: EtapaProduccion[];
  origenes: OrigenOp[];
  ciudades: Ciudad[];
  vistaInicial: Vista;
  campoFechaCalInicial: CampoFechaCal;
  filtrosIniciales: FiltrosOps;
  /** true solo para roles con módulo Ventas (Admins): habilita las
   *  cifras de dinero (valor por OP y suma por etapa en el kanban). */
  mostrarValores: boolean;
}

const VISTAS: { id: Vista; label: string }[] = [
  { id: "kanban", label: "▦ Kanban" },
  { id: "lista", label: "☰ Lista" },
  { id: "calendario", label: "▤ Calendario" },
];

const SEMAFORO_OPCIONES: { valor: SemaforoOp; label: string }[] = [
  { valor: "ninguno", label: "Sin alerta (+3 sem)" },
  { valor: "amarillo", label: "Amarillo (2–3 sem)" },
  { valor: "rojo", label: "Rojo (≤2 sem)" },
  { valor: "negro", label: "Negro (vencida)" },
];

const CLASE_SELECT =
  "h-9 rounded-input border border-borde bg-card px-2.5 text-[12.5px] font-medium text-carbon outline-none focus:border-dorado";

export function OrdenesClient({
  cardsIniciales,
  etapas,
  origenes,
  ciudades,
  vistaInicial,
  campoFechaCalInicial,
  filtrosIniciales,
  mostrarValores,
}: Props) {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [filtros, setFiltros] = useState<FiltrosOps>(filtrosIniciales);
  const [campoFechaCal, setCampoFechaCal] =
    useState<CampoFechaCal>(campoFechaCalInicial);
  // Estado optimista: el drag & drop actualiza aquí y persiste en el repo.
  const [cards, setCards] = useState<OpCard[]>(cardsIniciales);

  // Persistir vista + filtros en searchParams sin recargar el server component.
  useEffect(() => {
    const p = new URLSearchParams();
    if (vista !== "kanban") p.set("vista", vista);
    if (filtros.etapa_id) p.set("etapa", String(filtros.etapa_id));
    if (filtros.origen) p.set("origen", filtros.origen);
    if (filtros.ciudad_id) p.set("ciudad", String(filtros.ciudad_id));
    if (filtros.semaforo) p.set("semaforo", filtros.semaforo);
    if (filtros.texto?.trim()) p.set("q", filtros.texto.trim());
    if (campoFechaCal !== "entrega") p.set("fcal", campoFechaCal);
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [vista, filtros, campoFechaCal]);

  // El tablero por defecto oculta las archivadas (entregadas hace >7 días);
  // el botón Archivo las muestra solas. archivo===false ⇒ activas.
  const filtradas = useMemo(
    () => aplicarFiltros(cards, { ...filtros, archivo: filtros.archivo ?? false }),
    [cards, filtros],
  );
  const nArchivadas = useMemo(
    () => cards.filter((c) => esOpArchivada(c)).length,
    [cards],
  );

  // El Archivo es historia (entregadas viejas + anuladas): las etapas ya no
  // aplican, así que se muestra SIEMPRE como lista plana, sin kanban.
  const enArchivo = !!filtros.archivo;

  const hayFiltros =
    !!filtros.etapa_id ||
    !!filtros.origen ||
    !!filtros.ciudad_id ||
    !!filtros.semaforo ||
    !!filtros.texto?.trim();

  function moverEtapa(cardId: string, etapaId: number) {
    const anterior = cards;
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.etapa_id === etapaId) return;
    setCards(
      cards.map((c) => (c.id === cardId ? { ...c, etapa_id: etapaId } : c)),
    );
    // Persiste vía server action; revierte (y avisa) si la BD lo rechaza
    // (p. ej. entrega con saldo pendiente o ítems sin despachar).
    moverEtapaAction(cardId, etapaId)
      .then((r) => {
        if (!r.ok) {
          setCards(anterior);
          if (typeof window !== "undefined") window.alert(r.error);
        }
      })
      .catch(() => setCards(anterior));
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-neutro">Producción y Logística /</p>
          <h1 className="text-[26px] font-bold leading-tight text-carbon">
            Órdenes de pedido (O.P.)
          </h1>
        </div>
        <button
          type="button"
          className="rounded-pill bg-carbon px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black"
          title="Disponible en una fase posterior"
        >
          + Nueva O.P.
        </button>
      </div>

      {/* Conmutador de vistas + leyenda del semáforo */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={enArchivo}
            onClick={() => setVista(v.id)}
            className={`rounded-pill border px-4 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-40 ${
              vista === v.id && !enArchivo
                ? "border-carbon bg-carbon text-white"
                : "border-borde bg-card text-carbon hover:border-dorado"
            }`}
          >
            {v.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            setFiltros({ ...filtros, archivo: filtros.archivo ? undefined : true })
          }
          title={`Entregadas hace más de 7 días y anuladas (${nArchivadas}) — se muestran como lista`}
          className={`rounded-pill border px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
            filtros.archivo
              ? "border-carbon bg-carbon text-white"
              : "border-borde bg-card text-neutro hover:border-dorado"
          }`}
        >
          🗄 Archivo{nArchivadas > 0 ? ` (${nArchivadas})` : ""}
        </button>
        <div className="ml-auto hidden flex-wrap items-center gap-3 text-[11.5px] text-neutro md:flex">
          <span>Entrega:</span>
          <Leyenda color="bg-neutro-bg border border-borde" label="+3 sem" />
          <Leyenda color="bg-semaforo-amarillo" label="2–3 sem" />
          <Leyenda color="bg-semaforo-rojo" label="1–2 sem" />
          <Leyenda color="bg-semaforo-vencido" label="Vencida" />
        </div>
      </div>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filtros.texto ?? ""}
          onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
          placeholder="Buscar O.P., cliente o producto…"
          className={`${CLASE_SELECT} w-full sm:w-64`}
        />
        <select
          aria-label="Filtrar por etapa"
          value={filtros.etapa_id ?? ""}
          onChange={(e) =>
            setFiltros({
              ...filtros,
              etapa_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className={CLASE_SELECT}
        >
          <option value="">Todas las etapas</option>
          {etapas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por origen"
          value={filtros.origen ?? ""}
          onChange={(e) =>
            setFiltros({ ...filtros, origen: e.target.value || undefined })
          }
          className={CLASE_SELECT}
        >
          <option value="">Todos los orígenes</option>
          {origenes.map((o) => (
            <option key={o.id} value={o.clave}>
              {o.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por ciudad"
          value={filtros.ciudad_id ?? ""}
          onChange={(e) =>
            setFiltros({
              ...filtros,
              ciudad_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          className={CLASE_SELECT}
        >
          <option value="">Todas las ciudades</option>
          {ciudades.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por semáforo"
          value={filtros.semaforo ?? ""}
          onChange={(e) =>
            setFiltros({
              ...filtros,
              semaforo: (e.target.value || undefined) as SemaforoOp | undefined,
            })
          }
          className={CLASE_SELECT}
        >
          <option value="">Todo el semáforo</option>
          {SEMAFORO_OPCIONES.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.label}
            </option>
          ))}
        </select>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => setFiltros({ texto: "" })}
            className="rounded-pill px-3 py-1.5 text-[12px] font-semibold text-dorado-oscuro hover:bg-dorado-suave"
          >
            Limpiar filtros
          </button>
        )}
        <span className="ml-auto text-[12.5px] font-semibold text-neutro">
          {filtradas.length}{" "}
          {filtradas.length === 1 ? "resultado" : "resultados"}
        </span>
      </div>

      {/* Vista activa (el Archivo siempre en lista: las etapas no aplican) */}
      <div className="mt-5">
        {enArchivo ? (
          <>
            <p className="mb-3 text-[12.5px] text-neutro">
              🗄 Archivo — entregadas hace más de 7 días y anuladas. Abre
              cualquiera para ver su detalle.
            </p>
            <VistaLista cards={filtradas} etapas={etapas} />
          </>
        ) : (
          <>
            {vista === "kanban" && (
              <VistaKanban
                cards={filtradas}
                etapas={etapas}
                onMoverEtapa={moverEtapa}
                mostrarValores={mostrarValores}
              />
            )}
            {vista === "lista" && <VistaLista cards={filtradas} etapas={etapas} />}
            {vista === "calendario" && (
              <VistaCalendario
                cards={filtradas}
                campoFecha={campoFechaCal}
                onCampoFecha={setCampoFechaCal}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Leyenda({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[3px] ${color}`} />
      {label}
    </span>
  );
}
