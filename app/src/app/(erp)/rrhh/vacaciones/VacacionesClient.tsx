"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { EmpleadoCard, VacacionCard } from "@/lib/data/rrhh";
import { formatFechaCorta } from "@/lib/formato";
import {
  fechaRegreso,
  FESTIVOS_COLOMBIA,
  parseISO,
  ultimoDiaVacaciones,
} from "@/lib/vacaciones-logic";
import { decidirVacaciones, solicitarVacaciones } from "./actions";

interface Props {
  vacaciones: VacacionCard[];
  empleados: EmpleadoCard[];
}

const inputCls =
  "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

const ESTADO_BADGE: Record<string, string> = {
  solicitada: "bg-aviso text-aviso-texto ring-1 ring-aviso-borde",
  aprobada: "bg-azul-bg text-azul",
  disfrutada: "bg-verde-bg text-verde",
  rechazada: "bg-rojo-bg text-rojo",
};

/**
 * Vacaciones — reglas del dueño: días hábiles L–V con festivos de
 * Colombia; el regreso se calcula solo; aprueba un Admin; se ve quién
 * está de vacaciones, cuándo regresa, saldos y próximos aniversarios.
 */
export function VacacionesClient({ vacaciones, empleados }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [solicitando, setSolicitando] = useState(false);
  const [mesCal, setMesCal] = useState(() => {
    const d = new Date();
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const enVacaciones = empleados.filter((e) => e.regresaEl);
  const pendientes = vacaciones.filter((v) => v.vacacion.estado === "solicitada");
  const proximas = vacaciones.filter(
    (v) => v.vacacion.estado === "aprobada" && v.vacacion.desde > hoy,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">RRHH /</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">Vacaciones</h1>
          <p className="mt-0.5 text-[12.5px] text-neutro">
            Días hábiles L–V descontando festivos de Colombia · aprueba un
            Administrador.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSolicitando((v) => !v)}
          className="rounded-pill bg-carbon px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-black"
        >
          {solicitando ? "Cerrar formulario" : "+ Solicitar vacaciones"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-rojo/30 bg-rojo-bg px-4 py-3 text-[13px] font-semibold text-rojo">
          {error}
        </div>
      )}

      {/* Quién está de vacaciones AHORA + pendientes de aprobar */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-borde bg-card px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
            De vacaciones ahora
          </p>
          {enVacaciones.length === 0 ? (
            <p className="mt-1 text-[13px] text-neutro">Nadie — equipo completo 💪</p>
          ) : (
            enVacaciones.map((e) => (
              <p key={e.empleado.id} className="mt-1 text-[13.5px]">
                <b>{e.empleado.nombre}</b>{" "}
                <span className="text-[12px] text-verde">
                  regresa el {formatFechaCorta(parseISO(e.regresaEl!))}
                </span>
              </p>
            ))
          )}
        </div>
        <div className="rounded-card border border-borde bg-card px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
            Pendientes de aprobar
          </p>
          <p className={`text-[24px] font-extrabold ${pendientes.length ? "text-aviso-texto" : ""}`}>
            {pendientes.length}
          </p>
        </div>
        <div className="rounded-card border border-borde bg-card px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
            Aprobadas próximas a salir
          </p>
          <p className="text-[24px] font-extrabold">{proximas.length}</p>
        </div>
      </div>

      {solicitando && (
        <FormSolicitar
          empleados={empleados}
          onListo={() => {
            setSolicitando(false);
            router.refresh();
          }}
          onError={setError}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* Solicitudes */}
          <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
            <table className="w-full min-w-[680px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-borde text-left text-[11.5px] uppercase tracking-wider text-neutro">
                  <th className="px-4 py-3 font-bold">Empleado</th>
                  <th className="px-4 py-3 font-bold">Desde</th>
                  <th className="px-4 py-3 text-center font-bold">Días hábiles</th>
                  <th className="px-4 py-3 font-bold">Regresa</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold">Decisión</th>
                </tr>
              </thead>
              <tbody>
                {vacaciones.map((v) => (
                  <FilaVacacion
                    key={v.vacacion.id}
                    v={v}
                    onError={setError}
                    onRefrescar={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Saldos por empleado */}
          <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
            <p className="border-b border-borde px-4 py-3 text-[11.5px] font-bold uppercase tracking-wider text-neutro">
              Saldos — días pendientes y cuándo cumplen derecho
            </p>
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <tbody>
                {empleados.map((e) => (
                  <tr key={e.empleado.id} className="border-b border-borde last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{e.empleado.nombre}</td>
                    <td className="px-4 py-2.5 text-neutro">
                      {e.saldo ? `${e.saldo.devengados} devengados` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-neutro">
                      {e.saldo ? `${e.saldo.disfrutados} disfrutados` : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.saldo && (
                        <b
                          className={
                            e.saldo.pendientes > 15
                              ? "text-rojo"
                              : e.saldo.pendientes > 0
                                ? "text-verde"
                                : "text-neutro"
                          }
                        >
                          {e.saldo.pendientes} pendientes
                        </b>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-neutro">
                      {e.saldo &&
                        `+15 el ${formatFechaCorta(parseISO(e.saldo.proximoAniversario))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calendario */}
        <CalendarioVacaciones
          vacaciones={vacaciones}
          mes={mesCal}
          onMes={setMesCal}
        />
      </div>
    </div>
  );
}

function FilaVacacion({
  v,
  onError,
  onRefrescar,
}: {
  v: VacacionCard;
  onError: (e: string | null) => void;
  onRefrescar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const vac = v.vacacion;

  async function decidir(aprobar: boolean) {
    onError(null);
    setOcupado(true);
    const r = await decidirVacaciones(vac.id, aprobar);
    setOcupado(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onRefrescar();
  }

  return (
    <tr className="border-b border-borde last:border-0 hover:bg-sutil">
      <td className="px-4 py-3 font-semibold">
        {v.empleado.nombre}
        {vac.notas && (
          <span className="block text-[11.5px] font-normal italic text-neutro">
            {vac.notas}
          </span>
        )}
      </td>
      <td className="px-4 py-3">{formatFechaCorta(parseISO(vac.desde))}</td>
      <td className="px-4 py-3 text-center font-bold">{vac.dias_habiles}</td>
      <td className="px-4 py-3 font-semibold">
        {formatFechaCorta(parseISO(vac.hasta))}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold capitalize ${ESTADO_BADGE[vac.estado]}`}
        >
          {vac.estado}
        </span>
      </td>
      <td className="px-4 py-3">
        {vac.estado === "solicitada" ? (
          <span className="flex gap-1.5">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void decidir(true)}
              className="rounded-pill bg-verde px-3 py-1 text-[11.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              Aprobar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void decidir(false)}
              className="rounded-pill border border-rojo/40 px-3 py-1 text-[11.5px] font-bold text-rojo hover:bg-rojo-bg disabled:opacity-50"
            >
              Rechazar
            </button>
          </span>
        ) : (
          <span className="text-[11.5px] text-neutro">
            {v.aprobador ? v.aprobador.nombre.split(" ")[0] : "—"}
          </span>
        )}
      </td>
    </tr>
  );
}

/** Solicitud con CÁLCULO EN VIVO: último día + regreso (hábiles+festivos). */
function FormSolicitar({
  empleados,
  onListo,
  onError,
}: {
  empleados: EmpleadoCard[];
  onListo: () => void;
  onError: (e: string | null) => void;
}) {
  const [empleadoId, setEmpleadoId] = useState("");
  const [desde, setDesde] = useState("");
  const [dias, setDias] = useState(5);
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  const emp = empleados.find((e) => e.empleado.id === empleadoId);
  const calculo = useMemo(() => {
    if (!desde || dias <= 0) return null;
    try {
      return {
        ultimo: ultimoDiaVacaciones(desde, dias),
        regreso: fechaRegreso(desde, dias),
      };
    } catch {
      return null;
    }
  }, [desde, dias]);

  async function guardar() {
    onError(null);
    setGuardando(true);
    const r = await solicitarVacaciones({
      empleado_id: empleadoId,
      desde,
      dias_habiles: dias,
      notas: notas.trim() || null,
    });
    setGuardando(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onListo();
  }

  return (
    <div className="mb-5 rounded-card border border-borde bg-card p-5">
      <div className="flex flex-wrap items-end gap-3.5">
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          EMPLEADO *
          <select
            className={`${inputCls} min-w-[220px]`}
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {empleados.map((e) => (
              <option key={e.empleado.id} value={e.empleado.id}>
                {e.empleado.nombre}
                {e.saldo ? ` (${e.saldo.pendientes} días disp.)` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          DESDE *
          <input
            type="date"
            className={inputCls}
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-neutro">
          DÍAS HÁBILES *
          <input
            type="number"
            min={1}
            max={30}
            className={`${inputCls} w-[90px]`}
            value={dias}
            onChange={(e) => setDias(Number(e.target.value) || 0)}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-bold text-neutro">
          NOTAS
          <input
            className={`${inputCls} min-w-[180px]`}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={guardando || !empleadoId || !desde || dias <= 0}
          onClick={() => void guardar()}
          className="rounded-pill bg-carbon px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {guardando ? "Enviando…" : "Solicitar"}
        </button>
      </div>
      {calculo && (
        <p className="mt-3 rounded-[8px] bg-dorado-suave px-3.5 py-2.5 text-[13px]">
          Último día de vacaciones:{" "}
          <b>{formatFechaCorta(parseISO(calculo.ultimo))}</b> · Regresa a
          trabajar el <b className="text-dorado-oscuro">{formatFechaCorta(parseISO(calculo.regreso))}</b>{" "}
          <span className="text-[11.5px] text-neutro">
            (hábiles L–V, festivos de Colombia descontados)
          </span>
          {emp?.saldo && dias > emp.saldo.pendientes && (
            <span className="mt-1 block font-semibold text-rojo">
              ⚠ Pide {dias} y solo tiene {emp.saldo.pendientes} pendientes — cumple
              derecho a más el {formatFechaCorta(parseISO(emp.saldo.proximoAniversario))}.
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/** Calendario mensual: quién está de vacaciones cada día + festivos. */
function CalendarioVacaciones({
  vacaciones,
  mes,
  onMes,
}: {
  vacaciones: VacacionCard[];
  mes: { anio: number; mes: number };
  onMes: (m: { anio: number; mes: number }) => void;
}) {
  const activas = vacaciones.filter(
    (v) => v.vacacion.estado === "aprobada" || v.vacacion.estado === "disfrutada",
  );
  const primerDia = new Date(mes.anio, mes.mes, 1);
  const diasEnMes = new Date(mes.anio, mes.mes + 1, 0).getDate();
  const offset = (primerDia.getDay() + 6) % 7; // lunes = 0
  const nombreMes = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(primerDia);

  const iniciales = (n: string) =>
    n.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div className="h-fit rounded-card border border-borde bg-card p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMes(mes.mes === 0 ? { anio: mes.anio - 1, mes: 11 } : { anio: mes.anio, mes: mes.mes - 1 })}
          className="rounded-pill border border-borde px-3 py-1 text-[13px] hover:border-dorado"
          aria-label="Mes anterior"
        >
          ←
        </button>
        <p className="text-[13.5px] font-bold capitalize">{nombreMes}</p>
        <button
          type="button"
          onClick={() => onMes(mes.mes === 11 ? { anio: mes.anio + 1, mes: 0 } : { anio: mes.anio, mes: mes.mes + 1 })}
          className="rounded-pill border border-borde px-3 py-1 text-[13px] hover:border-dorado"
          aria-label="Mes siguiente"
        >
          →
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-neutro">
        {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
          <span key={`${d}${i}`}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: diasEnMes }).map((_, i) => {
          const dia = i + 1;
          const iso = `${mes.anio}-${String(mes.mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          const festivo = FESTIVOS_COLOMBIA.includes(iso);
          const finde = [0, 6].includes(new Date(mes.anio, mes.mes, dia).getDay());
          // de vacaciones: desde <= día < hasta (hasta = día de regreso)
          const gente = activas.filter(
            (v) => v.vacacion.desde <= iso && iso < v.vacacion.hasta,
          );
          return (
            <div
              key={dia}
              title={
                (festivo ? "Festivo · " : "") +
                gente.map((g) => g.empleado.nombre).join(", ")
              }
              className={`min-h-[42px] rounded-[6px] border p-1 text-left ${
                festivo
                  ? "border-dorado-claro bg-dorado-suave"
                  : finde
                    ? "border-transparent bg-sutil"
                    : "border-borde bg-card"
              }`}
            >
              <span className={`text-[10.5px] ${festivo ? "font-bold text-dorado-oscuro" : "text-neutro"}`}>
                {dia}
              </span>
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {gente.map((g) => (
                  <span
                    key={g.vacacion.id}
                    className="rounded bg-azul-bg px-1 text-[9px] font-bold text-azul"
                  >
                    {iniciales(g.empleado.nombre)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10.5px] text-neutro">
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dorado-claro bg-dorado-suave align-middle" />
        Festivo Colombia · las iniciales marcan quién está de vacaciones.
      </p>
    </div>
  );
}
