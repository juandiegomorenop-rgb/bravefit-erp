"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { diasEnEtapa } from "@/lib/cotizacion-logic";
import {
  ARCHIVO_DIAS_CRM,
  esOportunidadArchivada,
  vendedorPorDefecto,
  type FiltrosCrm,
  type OportunidadCard,
} from "@/lib/data/crm-cotizaciones";
import { crearClienteCatalogo } from "../cotizaciones/actions";
import { crearOportunidad, moverEtapaCrm } from "./actions";
import { formatCOP } from "@/lib/formato";
import type { Cliente, EtapaCrm, Usuario } from "@/lib/types/db";

interface Props {
  cardsIniciales: OportunidadCard[];
  etapas: EtapaCrm[];
  vendedores: Usuario[];
  clientes: Cliente[];
  filtrosIniciales: FiltrosCrm;
}

type Banner =
  | { tipo: "ok"; texto: string; opId?: string }
  | { tipo: "error"; texto: string };

/**
 * Embudo CRM: columnas = etapas parametrizables, fichas = oportunidades.
 * Drag & drop optimista; soltar en "Ganado" valida cotización con ítems
 * (réplica de fn_validar_ganada) y genera la OP automática — el banner
 * enlaza directo al detalle en Producción.
 */
export function CrmClient({
  cardsIniciales,
  etapas,
  vendedores,
  clientes,
  filtrosIniciales,
}: Props) {
  const router = useRouter();
  const [cards, setCards] = useState(cardsIniciales);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [colDestino, setColDestino] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  // Archivo del embudo: las cerradas (Ganado/Perdido) hace más de 7
  // días salen del tablero — su OP ya vive en Producción.
  const [verArchivo, setVerArchivo] = useState(false);

  // router.refresh() tras crear una oportunidad trae cards nuevas del
  // server: resincronizar el estado optimista con las props.
  useEffect(() => setCards(cardsIniciales), [cardsIniciales]);

  // ---- Alta manual de oportunidad (lead sin cotización) ----
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [nueva, setNueva] = useState({
    cliente_id: "",
    vendedor_id: "",
    valor: "",
    notas: "",
  });
  const [busquedaCli, setBusquedaCli] = useState("");
  const [clis, setClis] = useState<Cliente[]>(clientes);
  const [nuevoCliNombre, setNuevoCliNombre] = useState<string | null>(null);
  const [nuevoCliTel, setNuevoCliTel] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorNueva, setErrorNueva] = useState<string | null>(null);

  const clienteSel = clis.find((c) => c.id === nueva.cliente_id) ?? null;
  const clientesEncontrados = useMemo(() => {
    const q = busquedaCli.trim().toLowerCase();
    if (!q) return [];
    const qDigitos = q.replace(/\D/g, "");
    return clis
      .filter(
        (c) =>
          c.activo &&
          (c.nombre.toLowerCase().includes(q) ||
            (c.nit_cedula ?? "").toLowerCase().includes(q) ||
            // buscar también por teléfono evita crear duplicados
            (qDigitos.length >= 4 &&
              (c.telefono ?? "").replace(/\D/g, "").includes(qDigitos))),
      )
      .slice(0, 6);
  }, [busquedaCli, clis]);

  async function guardarNueva() {
    if (guardando) return;
    setErrorNueva(null);
    let clienteId = nueva.cliente_id;

    // Cliente nuevo inline (lead de WhatsApp/showroom que aún no existe)
    if (!clienteId && nuevoCliNombre?.trim()) {
      setGuardando(true);
      const rc = await crearClienteCatalogo({
        nombre: nuevoCliNombre.trim(),
        tipo: "persona",
        nit_cedula: null,
        telefono: nuevoCliTel.trim() || null,
      });
      if (!rc.ok) {
        setGuardando(false);
        setErrorNueva(rc.error);
        return;
      }
      setClis((cs) => [...cs, rc.cliente]);
      clienteId = rc.cliente.id;
    }
    if (!clienteId) {
      setErrorNueva("Selecciona o crea el cliente.");
      return;
    }
    setGuardando(true);
    const r = await crearOportunidad({
      cliente_id: clienteId,
      vendedor_id: nueva.vendedor_id || vendedorPorDefecto(vendedores),
      valor_estimado: nueva.valor ? Number(nueva.valor) || null : null,
      notas: nueva.notas.trim() || null,
    });
    setGuardando(false);
    if (!r.ok) {
      setErrorNueva(r.error);
      return;
    }
    setNuevaAbierta(false);
    setNueva({ cliente_id: "", vendedor_id: "", valor: "", notas: "" });
    setNuevoCliNombre(null);
    setNuevoCliTel("");
    setBusquedaCli("");
    setBanner({
      tipo: "ok",
      texto: "Oportunidad creada en «En conversaciones».",
    });
    router.refresh();
  }

  const archivadas = useMemo(
    () => cards.filter((c) => esOportunidadArchivada(c, etapas)),
    [cards, etapas],
  );

  const filtradas = useMemo(() => {
    const q = filtros.texto?.trim().toLowerCase();
    const base = verArchivo
      ? archivadas
      : cards.filter((c) => !esOportunidadArchivada(c, etapas));
    return base.filter((c) => {
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
    });
  }, [cards, archivadas, verArchivo, etapas, filtros]);

  function actualizarFiltros(nuevos: FiltrosCrm) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.vendedor_id) p.set("vendedor", nuevos.vendedor_id);
    if (nuevos.texto) p.set("q", nuevos.texto);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  async function mover(id: string, etapaId: number) {
    const card = cards.find((c) => c.oportunidad.id === id);
    const etapa = etapas.find((e) => e.id === etapaId);
    if (!card || !etapa || card.oportunidad.etapa_id === etapaId) return;

    const previo = cards;
    // optimista: mover la ficha ya; revertir si el repo rechaza
    setCards((cs) =>
      cs.map((c) =>
        c.oportunidad.id === id
          ? {
              ...c,
              oportunidad: {
                ...c.oportunidad,
                etapa_id: etapaId,
                movida_en: new Date().toISOString(),
              },
            }
          : c,
      ),
    );
    const r = await moverEtapaCrm(id, etapaId);
    if (!r.ok) {
      setCards(previo);
      setBanner({ tipo: "error", texto: r.error });
      return;
    }
    if (r.opCreada) {
      setBanner({
        tipo: "ok",
        texto: `¡Oportunidad ganada! Se generó la ${r.opCreada.numero} y entró a En Cola de producción.`,
        opId: r.opCreada.id,
      });
      // reflejar cotización Aprobada en la ficha
      setCards((cs) =>
        cs.map((c) =>
          c.oportunidad.id === id && c.cotizacion
            ? { ...c, cotizacion: { ...c.cotizacion, estado: "Aprobada" } }
            : c,
        ),
      );
    } else if (etapa.es_perdida) {
      setBanner({ tipo: "ok", texto: "Oportunidad marcada como perdida." });
    } else {
      setBanner(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">Ventas /</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">
            CRM — Embudo de ventas
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setNuevaAbierta((v) => !v)}
          className="rounded-pill bg-carbon px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black"
        >
          + Nueva oportunidad
        </button>
      </div>

      {/* Alta manual: lead que llega por WhatsApp/showroom ANTES de cotizar */}
      {nuevaAbierta && (
        <div className="mb-4 rounded-card border border-dorado bg-dorado-suave p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-dorado-oscuro">
            Nueva oportunidad — entra a «En conversaciones»
          </p>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
              CLIENTE *
              {clienteSel ? (
                <span className="flex items-center gap-2 rounded-input border border-borde bg-card px-3 py-2 text-[13px]">
                  <b className="min-w-0 flex-1 truncate">{clienteSel.nombre}</b>
                  <button
                    type="button"
                    onClick={() => setNueva({ ...nueva, cliente_id: "" })}
                    className="text-[11.5px] font-semibold text-dorado-oscuro hover:underline"
                  >
                    cambiar
                  </button>
                </span>
              ) : nuevoCliNombre !== null ? (
                <span className="flex flex-col gap-1.5">
                  <input
                    className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
                    placeholder="Nombre del cliente nuevo *"
                    value={nuevoCliNombre}
                    onChange={(e) => setNuevoCliNombre(e.target.value)}
                  />
                  <span className="flex gap-1.5">
                    <input
                      className="flex-1 rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
                      placeholder="Teléfono"
                      value={nuevoCliTel}
                      onChange={(e) => setNuevoCliTel(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setNuevoCliNombre(null)}
                      className="rounded-pill px-2.5 text-[11.5px] font-semibold text-neutro hover:bg-neutro-bg"
                    >
                      buscar existente
                    </button>
                  </span>
                </span>
              ) : (
                <span className="relative">
                  <input
                    className="w-full rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
                    placeholder="Buscar por nombre o cédula/NIT…"
                    value={busquedaCli}
                    onChange={(e) => setBusquedaCli(e.target.value)}
                  />
                  {busquedaCli.trim() && (
                    <span className="absolute z-20 mt-1 block w-full overflow-hidden rounded-card border border-borde bg-card shadow-lg">
                      {clientesEncontrados.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setNueva({ ...nueva, cliente_id: c.id });
                            setBusquedaCli("");
                          }}
                          className="block w-full px-3 py-2 text-left hover:bg-sutil"
                        >
                          <span className="block text-[13px] font-semibold">
                            {c.nombre}
                          </span>
                          <span className="text-[11px] font-normal text-neutro">
                            {c.nit_cedula ?? "sin documento"}
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setNuevoCliNombre(busquedaCli.trim());
                          setBusquedaCli("");
                        }}
                        className="block w-full border-t border-borde bg-dorado-suave px-3 py-2 text-left text-[12.5px] font-semibold text-dorado-oscuro hover:bg-dorado/20"
                      >
                        ＋ Crear cliente “{busquedaCli.trim()}”
                      </button>
                    </span>
                  )}
                </span>
              )}
            </div>
            <label className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
              VENDEDOR *
              <select
                className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
                value={nueva.vendedor_id || vendedorPorDefecto(vendedores)}
                onChange={(e) =>
                  setNueva({ ...nueva, vendedor_id: e.target.value })
                }
              >
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
              VALOR ESTIMADO (COP, opcional)
              <input
                type="number"
                min={0}
                className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
                value={nueva.valor}
                onChange={(e) => setNueva({ ...nueva, valor: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] font-bold text-neutro">
              NOTAS
              <input
                className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
                placeholder="Ej: preguntó por rack + banco por WhatsApp"
                value={nueva.notas}
                onChange={(e) => setNueva({ ...nueva, notas: e.target.value })}
              />
            </label>
          </div>
          {errorNueva && (
            <p className="mt-2 text-[12.5px] font-semibold text-rojo">
              {errorNueva}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardarNueva()}
              className="rounded-pill bg-carbon px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-40"
            >
              {guardando ? "Creando…" : "Crear oportunidad"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNuevaAbierta(false);
                setErrorNueva(null);
              }}
              className="rounded-pill px-3 py-1.5 text-[12.5px] font-semibold text-neutro hover:bg-neutro-bg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`mb-4 flex items-center justify-between gap-3 rounded-card border px-4 py-3 text-[13px] font-semibold ${
            banner.tipo === "ok"
              ? "border-verde/30 bg-verde-bg text-verde"
              : "border-rojo/30 bg-rojo-bg text-rojo"
          }`}
        >
          <span>{banner.texto}</span>
          <span className="flex shrink-0 items-center gap-3">
            {banner.tipo === "ok" && banner.opId && (
              <Link
                href={`/produccion/ordenes/${banner.opId}`}
                className="rounded-pill bg-verde px-3 py-1 text-[12px] font-bold text-white hover:opacity-90"
              >
                Ver la O.P. →
              </Link>
            )}
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-[16px] leading-none opacity-60 hover:opacity-100"
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          defaultValue={filtros.texto}
          onChange={(e) => actualizarFiltros({ ...filtros, texto: e.target.value })}
          placeholder="Buscar cliente, cotización o nota…"
          className="w-full max-w-[340px] rounded-input border border-borde bg-card px-3.5 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <select
          aria-label="Filtrar por vendedor"
          value={filtros.vendedor_id ?? ""}
          onChange={(e) =>
            actualizarFiltros({ ...filtros, vendedor_id: e.target.value || undefined })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todos los vendedores</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setVerArchivo((v) => !v)}
          title={`Ganadas y perdidas hace más de ${ARCHIVO_DIAS_CRM} días (${archivadas.length}) — su OP ya vive en Producción`}
          className={`rounded-pill border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
            verArchivo
              ? "border-carbon bg-carbon text-white"
              : "border-borde bg-card text-neutro hover:border-dorado"
          }`}
        >
          🗄 Archivo ({archivadas.length})
        </button>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtradas.length}</b> oportunidades ·{" "}
          <b className="text-carbon">
            {formatCOP(filtradas.reduce((a, c) => a + c.valor, 0))}
          </b>{" "}
          {verArchivo ? "archivadas" : "en juego"}
        </span>
      </div>

      <div className="-mx-4 flex items-start gap-3.5 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {etapas.map((etapa) => {
          const fichas = filtradas.filter(
            (c) => c.oportunidad.etapa_id === etapa.id,
          );
          const totalCol = fichas.reduce((a, c) => a + c.valor, 0);
          return (
            <div
              key={etapa.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setColDestino(etapa.id);
              }}
              onDragLeave={() => setColDestino(null)}
              onDrop={(e) => {
                e.preventDefault();
                setColDestino(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) void mover(id, etapa.id);
              }}
              className={`flex min-h-[380px] w-[272px] shrink-0 flex-col gap-2.5 rounded-card p-3 transition-shadow ${
                etapa.es_ganada
                  ? "bg-verde-bg/70"
                  : etapa.es_perdida
                    ? "bg-rojo-bg/60"
                    : "bg-kanban"
              } ${colDestino === etapa.id ? "ring-2 ring-dorado" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 px-1.5 pt-0.5">
                {/* Nombre completo en 2 líneas si hace falta: etapas como
                    "Elaborando Cotización y/o Render" no deben cortarse */}
                <span className="flex min-w-0 items-start gap-1.5 text-[11.5px] font-bold uppercase leading-tight tracking-wider text-neutro">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: etapa.color ?? "#5a5a5a" }}
                  />
                  <span className="break-words">{etapa.nombre}</span>
                </span>
                <span className="shrink-0 text-[11.5px] font-semibold text-neutro">
                  {fichas.length}
                </span>
              </div>
              {/* Total $ de la etapa — protagonista (pedido de Juan) */}
              <div
                className={`px-1.5 pb-1 text-[15px] font-extrabold ${
                  etapa.es_ganada
                    ? "text-verde"
                    : etapa.es_perdida
                      ? "text-rojo"
                      : "text-dorado-oscuro"
                }`}
              >
                {formatCOP(totalCol)}
              </div>
              {fichas.map((card) => (
                <TarjetaOportunidad key={card.oportunidad.id} card={card} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

function TarjetaOportunidad({ card }: { card: OportunidadCard }) {
  const dias = diasEnEtapa(card.oportunidad.movida_en);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.oportunidad.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-[11px] border border-[#e6e5e1] bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-shadow hover:border-dorado-claro hover:shadow-[0_4px_12px_rgba(0,0,0,.1)] active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <b className="text-[13px] leading-tight">{card.cliente.nombre}</b>
        <span
          title={card.vendedor.nombre}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dorado-suave text-[10px] font-extrabold text-dorado-oscuro"
        >
          {iniciales(card.vendedor.nombre)}
        </span>
      </div>
      <div className="mt-1 text-[13.5px] font-extrabold text-dorado-oscuro">
        {card.valor > 0 ? formatCOP(card.valor) : "Sin valor estimado"}
      </div>
      {card.oportunidad.notas && (
        <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-neutro">
          {card.oportunidad.notas}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {card.cotizacion ? (
          <Link
            href={`/ventas/cotizaciones/${card.cotizacion.id}`}
            onClick={(e) => e.stopPropagation()}
            className={`rounded-pill px-2 py-0.5 text-[10.5px] font-bold ${
              card.cotizacion.tiene_items
                ? "bg-azul-bg text-azul hover:underline"
                : "border border-aviso-borde bg-aviso text-aviso-texto hover:underline"
            }`}
            title={
              card.cotizacion.tiene_items
                ? `${card.cotizacion.numero} · ${card.cotizacion.estado}`
                : "Cotización sin ítems: no puede ganarse todavía"
            }
          >
            {card.cotizacion.numero}
            {!card.cotizacion.tiene_items && " · vacía"}
          </Link>
        ) : (
          <Link
            href={`/ventas/cotizaciones/nueva?cliente=${card.cliente.id}&vendedor=${card.vendedor.id}&oportunidad=${card.oportunidad.id}`}
            onClick={(e) => e.stopPropagation()}
            title="Crear la cotización de esta oportunidad (queda vinculada a esta ficha)"
            className="rounded-pill border border-dorado bg-dorado-suave px-2 py-0.5 text-[10.5px] font-bold text-dorado-oscuro hover:border-dorado-oscuro"
          >
            ＋ Cotizar
          </Link>
        )}
        {card.op && (
          <Link
            href={`/produccion/ordenes/${card.op.id}`}
            onClick={(e) => e.stopPropagation()}
            title="Ver la orden de pedido en Producción"
            className="rounded-pill bg-verde-bg px-2 py-0.5 text-[10.5px] font-bold text-verde hover:underline"
          >
            → {card.op.numero}
          </Link>
        )}
        <span className="ml-auto text-[10.5px] font-semibold text-neutro">
          {dias === 0 ? "hoy" : dias === 1 ? "1 día" : `${dias} días`} en etapa
        </span>
      </div>
    </div>
  );
}
