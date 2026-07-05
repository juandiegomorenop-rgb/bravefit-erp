import Link from "next/link";
import { notFound } from "next/navigation";
import { getRrhhRepository } from "@/lib/data/rrhh";
import { formatCOP, formatFecha, formatFechaCorta } from "@/lib/formato";
import { parseISO } from "@/lib/vacaciones-logic";
import type { Vacacion } from "@/lib/types/db";
import { BadgeArea, BadgeTecnico } from "../badges";

export const metadata = { title: "Ficha de empleado" };

const UMBRAL_ACUMULACION = 15;

const ESTADO_VACACION: Record<
  Vacacion["estado"],
  { nombre: string; badge: string }
> = {
  solicitada: {
    nombre: "Solicitada",
    badge: "border border-aviso-borde bg-aviso text-aviso-texto",
  },
  aprobada: { nombre: "Aprobada", badge: "bg-azul-bg text-azul" },
  rechazada: { nombre: "Rechazada", badge: "bg-rojo-bg text-rojo" },
  disfrutada: { nombre: "Disfrutada", badge: "bg-verde-bg text-verde" },
};

const ESTADO_EVAL: Record<string, { nombre: string; badge: string }> = {
  pendiente: { nombre: "Pendiente", badge: "bg-neutro-bg text-neutro" },
  en_curso: { nombre: "En curso", badge: "bg-azul-bg text-azul" },
  completada: { nombre: "Completada", badge: "bg-verde-bg text-verde" },
};

/**
 * Ficha del empleado: datos básicos + bloque CONFIDENCIAL separado (en
 * producción lo protege RLS: solo rrhh/Admin o el propio empleado),
 * saldo de vacaciones con la regla colombiana (15 días hábiles/año),
 * historial de vacaciones y evaluaciones de desempeño.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const det = await getRrhhRepository().obtenerEmpleado(id);
  if (!det) notFound();

  const e = det.empleado;
  const conf = det.confidencial;
  const saldo = det.saldo;
  const acumulado = (saldo?.pendientes ?? 0) > UMBRAL_ACUMULACION;

  return (
    <div className="mx-auto max-w-[920px]">
      <p className="text-[12.5px] text-neutro">
        <Link href="/rrhh/empleados" className="hover:underline">
          Recursos Humanos / Empleados
        </Link>{" "}
        / {e.nombre}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-extrabold tracking-tight">{e.nombre}</h1>
        {e.es_tecnico && <BadgeTecnico grande />}
        <BadgeArea area={e.area} />
        {det.regresaEl && (
          <span className="rounded-pill border border-aviso-borde bg-aviso px-3 py-1 text-[12px] font-bold text-aviso-texto">
            De vacaciones · regresa el {formatFecha(parseISO(det.regresaEl))}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-neutro">{e.cargo ?? "Sin cargo"}</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Columna principal */}
        <div className="space-y-4">
          {/* Datos básicos */}
          <div className="rounded-card border border-borde bg-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Datos básicos
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                  Cédula
                </p>
                <p className="font-semibold">{e.cedula}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                  Fecha de ingreso
                </p>
                <p className="font-semibold">
                  {e.fecha_ingreso ? formatFecha(parseISO(e.fecha_ingreso)) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                  Años de servicio
                </p>
                <p className="font-semibold">
                  {saldo
                    ? saldo.aniosServicio === 0
                      ? "Menos de 1 año"
                      : saldo.aniosServicio === 1
                        ? "1 año"
                        : `${saldo.aniosServicio} años`
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Bloque CONFIDENCIAL — borde dorado y candado */}
          <div className="rounded-card border-2 border-dorado bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-dorado-oscuro">
                🔒 Confidencial
              </p>
              <p className="text-[11px] font-semibold text-neutro">
                Solo Admin o el propio empleado — RLS en BD
              </p>
            </div>
            {conf ? (
              <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                    Tipo de contrato
                  </p>
                  <p className="font-semibold">{conf.tipo_contrato ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                    Salario base
                  </p>
                  <p className="font-semibold">
                    {conf.salario_base !== null ? formatCOP(conf.salario_base) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                    EPS
                  </p>
                  <p className="font-semibold">{conf.eps ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                    ARL
                  </p>
                  <p className="font-semibold">{conf.arl ?? "—"}</p>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-neutro">
                    Hoja de vida
                  </p>
                  {conf.hoja_vida_url ? (
                    <a
                      href={conf.hoja_vida_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-azul hover:underline"
                    >
                      Ver PDF adjunto →
                    </a>
                  ) : (
                    <p className="italic text-neutro">
                      PDF en Storage — pendiente de carga
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[13px] italic text-neutro">
                Sin datos confidenciales registrados.
              </p>
            )}
            <p className="mt-4 rounded-[10px] bg-dorado-suave px-3 py-2 text-[12px] font-semibold text-dorado-oscuro">
              Nómina se liquida en Siigo — aquí no se calculan pagos.
            </p>
          </div>

          {/* Historial de vacaciones */}
          <div className="rounded-card border border-borde bg-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Historial de vacaciones
            </p>
            {det.vacaciones.length === 0 ? (
              <p className="mt-3 text-[13px] italic text-neutro">
                Sin solicitudes de vacaciones todavía.
              </p>
            ) : (
              <table className="mt-2 w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-neutro">
                    <th className="py-1.5 pr-3 font-bold">Desde</th>
                    <th className="px-3 py-1.5 font-bold">Regresa</th>
                    <th className="px-3 py-1.5 text-right font-bold">Días hábiles</th>
                    <th className="px-3 py-1.5 font-bold">Estado</th>
                    <th className="px-3 py-1.5 font-bold">Aprobó</th>
                  </tr>
                </thead>
                <tbody>
                  {det.vacaciones.map((v) => {
                    const est = ESTADO_VACACION[v.vacacion.estado];
                    return (
                      <tr key={v.vacacion.id} className="border-t border-borde">
                        <td className="py-2 pr-3 font-semibold">
                          {formatFechaCorta(parseISO(v.vacacion.desde))}
                        </td>
                        <td className="px-3 py-2">
                          {formatFechaCorta(parseISO(v.vacacion.hasta))}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {v.vacacion.dias_habiles}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-pill px-2.5 py-0.5 text-[10.5px] font-bold ${est.badge}`}
                          >
                            {est.nombre}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-neutro">
                          {v.aprobador?.nombre.split(" ")[0] ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-[11.5px] text-neutro">
              Las solicitudes se gestionan en{" "}
              <Link
                href="/rrhh/vacaciones"
                className="font-bold text-azul hover:underline"
              >
                RRHH / Vacaciones
              </Link>{" "}
              — solo Admin aprueba.
            </p>
          </div>

          {/* Evaluaciones */}
          <div className="rounded-card border border-borde bg-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Evaluaciones de desempeño
            </p>
            {det.evaluaciones.length === 0 ? (
              <p className="mt-3 text-[13px] italic text-neutro">
                Sin evaluaciones registradas.
              </p>
            ) : (
              <table className="mt-2 w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wider text-neutro">
                    <th className="py-1.5 pr-3 font-bold">Ciclo</th>
                    <th className="px-3 py-1.5 text-right font-bold">Puntaje</th>
                    <th className="px-3 py-1.5 font-bold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {det.evaluaciones.map((ev) => {
                    const est = ESTADO_EVAL[ev.estado];
                    return (
                      <tr key={ev.id} className="border-t border-borde">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/rrhh/evaluaciones?ciclo=${encodeURIComponent(ev.ciclo)}`}
                            className="font-bold text-azul hover:underline"
                          >
                            {ev.ciclo}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold">
                          {ev.puntaje !== null ? (
                            <>
                              {ev.puntaje}
                              <span className="font-semibold text-neutro"> / 5</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-pill px-2.5 py-0.5 text-[10.5px] font-bold ${est.badge}`}
                          >
                            {est.nombre}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Lateral: saldo de vacaciones */}
        <div className="space-y-4">
          <div className="rounded-card border border-borde bg-card p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutro">
              Saldo de vacaciones
            </p>
            {saldo ? (
              <>
                <p
                  className={`mt-2 text-[34px] font-extrabold leading-none ${
                    acumulado ? "text-rojo" : ""
                  }`}
                >
                  {saldo.pendientes}
                  <span className="ml-1 text-[14px] font-bold text-neutro">
                    días pendientes
                  </span>
                </p>
                {acumulado && (
                  <p className="mt-1.5 rounded-[10px] bg-rojo-bg px-3 py-2 text-[12px] font-bold text-rojo">
                    ⚠ Acumulación alta: supera los 15 días. Programe el
                    descanso.
                  </p>
                )}
                <div className="mt-4 space-y-2 text-[13px]">
                  <p className="flex justify-between">
                    <span className="text-neutro">Devengados</span>
                    <b>{saldo.devengados} días</b>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-neutro">Disfrutados</span>
                    <b>{saldo.disfrutados} días</b>
                  </p>
                  <p className="flex justify-between border-t border-borde pt-2">
                    <span className="text-neutro">Pendientes</span>
                    <b className={acumulado ? "text-rojo" : ""}>
                      {saldo.pendientes} días
                    </b>
                  </p>
                </div>
                <p className="mt-4 rounded-[10px] bg-sutil px-3 py-2 text-[12px] leading-relaxed text-neutro">
                  Cumple derecho a 15 días más el{" "}
                  <b className="text-carbon">
                    {formatFecha(parseISO(saldo.proximoAniversario))}
                  </b>
                  .
                </p>
              </>
            ) : (
              <p className="mt-3 text-[13px] italic text-neutro">
                Sin fecha de ingreso: no se puede calcular el saldo.
              </p>
            )}
          </div>

          <div className="rounded-card border border-borde bg-sutil p-5 text-[12.5px] leading-relaxed text-neutro">
            Los días hábiles de vacaciones se cuentan L–V excluyendo festivos
            de Colombia (ley: 15 días hábiles por año). La fecha de regreso se
            calcula con esa misma regla.
          </div>
        </div>
      </div>
    </div>
  );
}
