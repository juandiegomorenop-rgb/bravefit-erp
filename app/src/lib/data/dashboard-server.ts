/**
 * KPIs REALES del Dashboard (server-only) — decisión de Juan 20-jul-2026:
 *   · Ventas / Producción / Logística: 100% desde las OPs, entregas y
 *     CRM reales de Supabase (mismas fuentes que sus módulos).
 *   · Mercadeo: leads / tasa de cierre / valor ganado salen del embudo
 *     CRM REAL; el ROAS queda null hasta conectar Meta Ads.
 *   · RRHH: sigue el mock (módulo sin conectar) — la UI lo marca como
 *     datos de ejemplo.
 *   · Capacidad de planta: OCULTA hasta cargar el BOM de tubería (la
 *     página ya no la consulta).
 */
import { getCrmRepository } from "@/lib/data/crm-cotizaciones-server";
import {
  calcularKpis,
  etiquetaMes,
  type KpisDashboard,
} from "@/lib/data/dashboard";
import { getEntregasRepository } from "@/lib/data/entregas-server";
import type { RangoFechas } from "@/lib/data/mercadeo";
import { getOpsRepository } from "@/lib/data/ops-server";
import { getRrhhRepository } from "@/lib/data/rrhh";

export async function kpisDashboard(rango: RangoFechas): Promise<KpisDashboard> {
  const ops = getOpsRepository();
  const rrhh = getRrhhRepository();
  const crm = getCrmRepository();

  const [
    cards,
    etapas,
    garantias,
    empleados,
    vacaciones,
    oportunidades,
    etapasCrm,
    resumenEntregas,
  ] = await Promise.all([
    ops.listarOps(),
    ops.listarEtapas(),
    ops.listarGarantias({ estado: "abiertas" }),
    rrhh.listarEmpleados(),
    rrhh.listarVacaciones({ estado: "solicitada" }),
    crm.listarOportunidades(),
    crm.listarEtapas(),
    getEntregasRepository().resumenMensual(24),
  ]);

  // Récord mensual REAL de entregas (24 meses de ventana)
  const record = resumenEntregas.reduce(
    (best, r) =>
      r.entregas > best.n
        ? {
            n: r.entregas,
            etiqueta: etiquetaMes(
              Number(r.mes.slice(0, 4)),
              Number(r.mes.slice(5)) - 1,
            ),
          }
        : best,
    { n: 0, etiqueta: "—" },
  );

  // Embudo CRM real → KPIs de mercadeo (leads = oportunidades del periodo)
  const ganadas = new Set(
    etapasCrm.filter((e) => e.es_ganada).map((e) => e.id),
  );
  const perdidas = new Set(
    etapasCrm.filter((e) => e.es_perdida).map((e) => e.id),
  );
  const enRango = (iso: string) => {
    const d = iso.slice(0, 10);
    return d >= rango.desde && d <= rango.hasta;
  };
  const leads = oportunidades.filter((o) =>
    enRango(o.oportunidad.creado_en),
  ).length;
  const cerradasGanadas = oportunidades.filter(
    (o) => ganadas.has(o.oportunidad.etapa_id) && enRango(o.oportunidad.movida_en),
  );
  const cerradasPerdidas = oportunidades.filter(
    (o) => perdidas.has(o.oportunidad.etapa_id) && enRango(o.oportunidad.movida_en),
  );
  const cerradas = cerradasGanadas.length + cerradasPerdidas.length;
  const valor_ganado = cerradasGanadas.reduce((a, o) => a + o.valor, 0);
  const pipeline_valor = oportunidades
    .filter(
      (o) =>
        !ganadas.has(o.oportunidad.etapa_id) &&
        !perdidas.has(o.oportunidad.etapa_id),
    )
    .reduce((a, o) => a + o.valor, 0);

  return calcularKpis(
    {
      cards: cards.filter((c) => !c.anulada),
      etapas,
      garantias_abiertas: garantias.length,
      // RRHH: mock hasta conectar el módulo — la UI lo marca "ejemplo".
      rrhh: {
        empleados: empleados.length,
        tecnicos: empleados.filter((e) => e.empleado.es_tecnico).length,
        de_vacaciones: empleados.filter((e) => e.regresaEl).length,
        vacaciones_pendientes: vacaciones.length,
      },
      mercadeo: {
        leads,
        tasa_cierre: cerradas > 0 ? cerradasGanadas.length / cerradas : 0,
        roas_meta: null, // hasta conectar Meta Ads
        valor_ganado,
      },
      pipeline_valor,
      record,
    },
    rango,
  );
}
