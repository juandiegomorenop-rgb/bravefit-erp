/**
 * Data layer de RRHH — INTERCAMBIABLE (patrón ops.ts).
 * Empleados (ficha básica + confidencial), Vacaciones (días hábiles L–V
 * + festivos Colombia, aprueba Admin), Evaluaciones y Reclutamiento.
 *
 * NOTA RLS: en producción `empleados_confidencial` solo la ve rrhh
 * (Admin) o el propio empleado; Ops1 ve vacaciones de técnicos, Ops2
 * solo las suyas. El mock sirve la vista de Admin.
 */

import { fechaRel, tsRel, USUARIOS } from "@/lib/data/ops";
import {
  fechaRegreso,
  saldoVacaciones,
  type SaldoVacaciones,
} from "@/lib/vacaciones-logic";
import type {
  Aplicacion,
  Empleado,
  EmpleadoConfidencial,
  Evaluacion,
  Usuario,
  Vacacion,
  Vacante,
} from "@/lib/types/db";

// ---------------------------------------------------------------
// Tipos enriquecidos para la UI
// ---------------------------------------------------------------

export interface EmpleadoCard {
  empleado: Empleado;
  confidencial: EmpleadoConfidencial | null;
  saldo: SaldoVacaciones | null; // null si no tiene fecha_ingreso
  /** Si está de vacaciones AHORA: fecha de regreso; si no, null. */
  regresaEl: string | null;
}

export interface EmpleadoDetalle extends EmpleadoCard {
  vacaciones: VacacionCard[];
  evaluaciones: Evaluacion[];
}

export interface VacacionCard {
  vacacion: Vacacion;
  empleado: Empleado;
  aprobador: Usuario | null;
}

export interface EvaluacionCard {
  evaluacion: Evaluacion;
  empleado: Empleado;
  evaluador: Usuario | null;
}

export interface VacanteCard {
  vacante: Vacante;
  aplicaciones: Aplicacion[];
}

export interface RrhhRepository {
  listarEmpleados(filtros?: {
    area?: string;
    solo_tecnicos?: boolean;
    texto?: string;
  }): Promise<EmpleadoCard[]>;
  obtenerEmpleado(id: string): Promise<EmpleadoDetalle | null>;
  // Vacaciones
  listarVacaciones(filtros?: {
    estado?: Vacacion["estado"];
    empleado_id?: string;
  }): Promise<VacacionCard[]>;
  /** Valida saldo suficiente y no solapamiento; hasta = fecha de REGRESO. */
  solicitarVacaciones(input: {
    empleado_id: string;
    desde: string;
    dias_habiles: number;
    notas: string | null;
  }): Promise<Vacacion>;
  /** Solo Admin aprueba (regla del dueño). */
  decidirVacaciones(id: string, aprobar: boolean, nota?: string): Promise<void>;
  // Evaluaciones
  listarEvaluaciones(ciclo?: string): Promise<EvaluacionCard[]>;
  listarCiclos(): Promise<string[]>;
  guardarEvaluacion(
    id: string,
    datos: {
      criterios: { nombre: string; puntaje: number }[];
      estado: Evaluacion["estado"];
    },
  ): Promise<void>;
  // Reclutamiento
  listarVacantes(): Promise<VacanteCard[]>;
  crearVacante(cargo: string, area: string | null): Promise<Vacante>;
  moverAplicacion(id: string, etapa: Aplicacion["etapa"]): Promise<void>;
  agregarAplicacion(input: {
    vacante_id: string;
    nombre: string;
    contacto: string | null;
  }): Promise<Aplicacion>;
}

// ===============================================================
// MOCK
// ===============================================================

function emp(
  id: string,
  nombre: string,
  cedula: string,
  cargo: string,
  area: string,
  es_tecnico: boolean,
  ingreso: string,
): Empleado {
  return {
    id,
    nombre,
    cedula,
    cargo,
    area,
    es_tecnico,
    fecha_ingreso: ingreso,
    activo: true,
    eliminado_en: null,
  };
}

export const EMPLEADOS: Empleado[] = [
  emp("e-01", "Juan Diego Moreno", "1.020.111.222", "Gerente general", "administración", false, "2024-02-01"),
  emp("e-02", "María Fernández", "1.035.222.333", "Comercial", "administración", false, "2024-08-15"),
  emp("e-03", "Camilo Torres", "1.017.333.444", "Comercial y compras", "administración", false, "2025-01-20"),
  emp("e-04", "Jorge Betancur", "71.444.555", "Jefe de planta", "planta", false, "2024-03-10"),
  emp("e-05", "Wilson Pérez", "1.040.555.666", "Técnico soldador", "planta", true, "2024-05-02"),
  emp("e-06", "Éider Muñoz", "1.041.666.777", "Técnico pintor", "planta", true, "2024-11-04"),
  emp("e-07", "Sebastián Cano", "1.042.777.888", "Técnico ensamblador", "planta", true, "2025-03-17"),
  emp("e-08", "Robinson Gil", "1.043.888.999", "Técnico de corte", "planta", true, "2025-09-01"),
];

const CONFIDENCIAL: EmpleadoConfidencial[] = [
  { empleado_id: "e-01", tipo_contrato: "Indefinido", salario_base: 6_500_000, eps: "Sura", arl: "Sura", hoja_vida_url: null },
  { empleado_id: "e-02", tipo_contrato: "Indefinido", salario_base: 3_200_000, eps: "Sura", arl: "Sura", hoja_vida_url: null },
  { empleado_id: "e-03", tipo_contrato: "Indefinido", salario_base: 2_900_000, eps: "Nueva EPS", arl: "Sura", hoja_vida_url: null },
  { empleado_id: "e-04", tipo_contrato: "Indefinido", salario_base: 3_800_000, eps: "Sura", arl: "Sura", hoja_vida_url: null },
  { empleado_id: "e-05", tipo_contrato: "Indefinido", salario_base: 2_400_000, eps: "Savia Salud", arl: "Sura", hoja_vida_url: null },
  { empleado_id: "e-06", tipo_contrato: "Indefinido", salario_base: 2_200_000, eps: "Nueva EPS", arl: "Sura", hoja_vida_url: null },
  { empleado_id: "e-07", tipo_contrato: "Obra o labor", salario_base: 1_950_000, eps: "Sura", arl: "Sura", hoja_vida_url: null },
  { empleado_id: "e-08", tipo_contrato: "Obra o labor", salario_base: 1_850_000, eps: "Savia Salud", arl: "Sura", hoja_vida_url: null },
];

function vac(
  id: string,
  empleado_id: string,
  desde: string,
  dias: number,
  estado: Vacacion["estado"],
  extra: Partial<Vacacion> = {},
): Vacacion {
  return {
    id,
    empleado_id,
    desde,
    hasta: fechaRegreso(desde, dias), // regreso con hábiles + festivos
    dias_habiles: dias,
    estado,
    aprobada_por: estado === "aprobada" || estado === "disfrutada" ? "u-01" : null,
    notas: null,
    creado_en: tsRel(-30),
    ...extra,
  };
}

const VACACIONES: Vacacion[] = [
  // Wilson DE VACACIONES AHORA (empezó hace 3 días, 10 hábiles)
  vac("v-01", "e-05", fechaRel(-3), 10, "aprobada", { creado_en: tsRel(-12) }),
  // Éider: SOLICITADA, pendiente de que un Admin decida
  vac("v-02", "e-06", fechaRel(12), 5, "solicitada", {
    creado_en: tsRel(-1),
    notas: "Viaje familiar a Urabá.",
  }),
  // Históricas
  vac("v-03", "e-02", fechaRel(-120), 15, "disfrutada", { creado_en: tsRel(-140) }),
  vac("v-04", "e-07", fechaRel(-60), 5, "disfrutada", { creado_en: tsRel(-75) }),
  vac("v-05", "e-04", fechaRel(-45), 8, "rechazada", {
    creado_en: tsRel(-50),
    notas: "Rechazada: coincidía con la entrega del pedido del hotel.",
  }),
  vac("v-06", "e-01", fechaRel(-200), 10, "disfrutada", { creado_en: tsRel(-215) }),
];

const CRITERIOS_BASE = ["Calidad del trabajo", "Cumplimiento", "Trabajo en equipo", "Seguridad y orden"];

function evaluacion(
  id: string,
  empleado_id: string,
  ciclo: string,
  puntajes: number[] | null,
  evaluador_id: string | null,
): Evaluacion {
  const criterios = puntajes
    ? CRITERIOS_BASE.map((nombre, i) => ({ nombre, puntaje: puntajes[i] }))
    : [];
  const puntaje = puntajes
    ? Math.round((puntajes.reduce((a, b) => a + b, 0) / puntajes.length) * 100) / 100
    : null;
  return {
    id,
    empleado_id,
    ciclo,
    puntaje,
    criterios,
    estado: puntajes ? "completada" : "pendiente",
    evaluador_id,
  };
}

const EVALUACIONES: Evaluacion[] = [
  // Ciclo 2026-1 completado
  evaluacion("ev-01", "e-05", "2026-1", [4.5, 4.0, 4.5, 4.0], "u-01"),
  evaluacion("ev-02", "e-06", "2026-1", [4.0, 4.5, 4.0, 4.5], "u-01"),
  evaluacion("ev-03", "e-07", "2026-1", [3.5, 4.0, 4.5, 3.5], "u-01"),
  evaluacion("ev-04", "e-08", "2026-1", [4.0, 3.5, 4.0, 4.0], "u-01"),
  evaluacion("ev-05", "e-02", "2026-1", [4.5, 4.5, 5.0, 4.0], "u-01"),
  evaluacion("ev-06", "e-03", "2026-1", [4.0, 4.0, 4.5, 4.0], "u-01"),
  evaluacion("ev-07", "e-04", "2026-1", [4.5, 5.0, 4.0, 4.5], "u-01"),
  // Ciclo 2026-2 pendiente (técnicos)
  evaluacion("ev-08", "e-05", "2026-2", null, null),
  evaluacion("ev-09", "e-06", "2026-2", null, null),
  evaluacion("ev-10", "e-07", "2026-2", null, null),
  evaluacion("ev-11", "e-08", "2026-2", null, null),
];

const VACANTES: Vacante[] = [
  { id: "va-01", cargo: "Técnico soldador MIG", area: "planta", estado: "abierta", publicada_en: fechaRel(-14), activo: true, eliminado_en: null },
  { id: "va-02", cargo: "Auxiliar de logística", area: "planta", estado: "abierta", publicada_en: fechaRel(-7), activo: true, eliminado_en: null },
  { id: "va-03", cargo: "Diseñador industrial", area: "administración", estado: "cerrada", publicada_en: fechaRel(-90), activo: true, eliminado_en: null },
];

const APLICACIONES: Aplicacion[] = [
  { id: "ap-01", vacante_id: "va-01", nombre: "Julián Ospina", contacto: "310 111 2233", etapa: "entrevista", cv_url: null, creado_en: tsRel(-10) },
  { id: "ap-02", vacante_id: "va-01", nombre: "Ferney Castaño", contacto: "301 222 3344", etapa: "finalista", cv_url: null, creado_en: tsRel(-12) },
  { id: "ap-03", vacante_id: "va-01", nombre: "Deiby Álvarez", contacto: "312 333 4455", etapa: "aplico", cv_url: null, creado_en: tsRel(-2) },
  { id: "ap-04", vacante_id: "va-01", nombre: "Óscar Rentería", contacto: "300 444 5566", etapa: "descartado", cv_url: null, creado_en: tsRel(-11) },
  { id: "ap-05", vacante_id: "va-02", nombre: "Katherine López", contacto: "313 555 6677", etapa: "entrevista", cv_url: null, creado_en: tsRel(-4) },
  { id: "ap-06", vacante_id: "va-02", nombre: "Brayan Úsuga", contacto: "314 666 7788", etapa: "aplico", cv_url: null, creado_en: tsRel(-1) },
  { id: "ap-07", vacante_id: "va-03", nombre: "Laura Cardona", contacto: "315 777 8899", etapa: "contratado", cv_url: null, creado_en: tsRel(-80) },
];

// ---------------------------------------------------------------
// Store singleton
// ---------------------------------------------------------------

interface RrhhStore {
  vacaciones: Vacacion[];
  evaluaciones: Evaluacion[];
  vacantes: Vacante[];
  aplicaciones: Aplicacion[];
}

const g = globalThis as unknown as {
  __rrhhStore?: RrhhStore;
  __rrhhRepositorio?: RrhhRepository;
};

function getStore(): RrhhStore {
  g.__rrhhStore ??= {
    vacaciones: structuredClone(VACACIONES),
    evaluaciones: structuredClone(EVALUACIONES),
    vacantes: structuredClone(VACANTES),
    aplicaciones: structuredClone(APLICACIONES),
  };
  return g.__rrhhStore;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export class MockRrhhRepository implements RrhhRepository {
  private get store() {
    return getStore();
  }

  /** aprobada cuyo regreso ya pasó → disfrutada (normalización al leer). */
  private normalizar(): void {
    const hoy = hoyISO();
    for (const v of this.store.vacaciones) {
      if (v.estado === "aprobada" && v.hasta <= hoy) v.estado = "disfrutada";
    }
  }

  private diasDisfrutados(empleado_id: string): number {
    return this.store.vacaciones
      .filter(
        (v) =>
          v.empleado_id === empleado_id &&
          (v.estado === "disfrutada" || v.estado === "aprobada"),
      )
      .reduce((a, v) => a + v.dias_habiles, 0);
  }

  private card(e: Empleado): EmpleadoCard {
    const hoy = hoyISO();
    const enCurso = this.store.vacaciones.find(
      (v) =>
        v.empleado_id === e.id &&
        v.estado === "aprobada" &&
        v.desde <= hoy &&
        v.hasta > hoy,
    );
    return {
      empleado: structuredClone(e),
      confidencial:
        CONFIDENCIAL.find((c) => c.empleado_id === e.id) ?? null,
      saldo: e.fecha_ingreso
        ? saldoVacaciones(e.fecha_ingreso, this.diasDisfrutados(e.id))
        : null,
      regresaEl: enCurso?.hasta ?? null,
    };
  }

  async listarEmpleados(
    filtros: { area?: string; solo_tecnicos?: boolean; texto?: string } = {},
  ): Promise<EmpleadoCard[]> {
    this.normalizar();
    const q = filtros.texto?.trim().toLowerCase();
    return EMPLEADOS.filter((e) => e.activo)
      .filter((e) => !filtros.area || e.area === filtros.area)
      .filter((e) => !filtros.solo_tecnicos || e.es_tecnico)
      .filter(
        (e) =>
          !q ||
          [e.nombre, e.cargo ?? "", e.cedula].join(" ").toLowerCase().includes(q),
      )
      .map((e) => this.card(e));
  }

  async obtenerEmpleado(id: string): Promise<EmpleadoDetalle | null> {
    this.normalizar();
    const e = EMPLEADOS.find((x) => x.id === id && x.activo);
    if (!e) return null;
    return structuredClone({
      ...this.card(e),
      vacaciones: this.store.vacaciones
        .filter((v) => v.empleado_id === id)
        .sort((a, b) => b.desde.localeCompare(a.desde))
        .map((v) => this.vacCard(v)),
      evaluaciones: this.store.evaluaciones
        .filter((ev) => ev.empleado_id === id)
        .sort((a, b) => b.ciclo.localeCompare(a.ciclo)),
    });
  }

  private vacCard(v: Vacacion): VacacionCard {
    return {
      vacacion: structuredClone(v),
      empleado: EMPLEADOS.find((e) => e.id === v.empleado_id)!,
      aprobador: USUARIOS.find((u) => u.id === v.aprobada_por) ?? null,
    };
  }

  async listarVacaciones(
    filtros: { estado?: Vacacion["estado"]; empleado_id?: string } = {},
  ): Promise<VacacionCard[]> {
    this.normalizar();
    return this.store.vacaciones
      .filter((v) => !filtros.estado || v.estado === filtros.estado)
      .filter((v) => !filtros.empleado_id || v.empleado_id === filtros.empleado_id)
      .sort((a, b) => b.desde.localeCompare(a.desde))
      .map((v) => this.vacCard(v));
  }

  async solicitarVacaciones(input: {
    empleado_id: string;
    desde: string;
    dias_habiles: number;
    notas: string | null;
  }): Promise<Vacacion> {
    const e = EMPLEADOS.find((x) => x.id === input.empleado_id && x.activo);
    if (!e) throw new Error("Seleccione el empleado");
    if (input.dias_habiles <= 0) {
      throw new Error("Los días hábiles deben ser mayores a 0");
    }
    if (input.desde < hoyISO()) {
      throw new Error("Las vacaciones no pueden iniciar en el pasado");
    }
    if (e.fecha_ingreso) {
      const saldo = saldoVacaciones(e.fecha_ingreso, this.diasDisfrutados(e.id));
      if (input.dias_habiles > saldo.pendientes) {
        throw new Error(
          `${e.nombre} tiene ${saldo.pendientes} días pendientes y pide ${input.dias_habiles}. Cumple derecho a más días el ${saldo.proximoAniversario}.`,
        );
      }
    }
    const hasta = fechaRegreso(input.desde, input.dias_habiles);
    const solapa = this.store.vacaciones.some(
      (v) =>
        v.empleado_id === input.empleado_id &&
        (v.estado === "aprobada" || v.estado === "solicitada") &&
        v.desde < hasta &&
        input.desde < v.hasta,
    );
    if (solapa) {
      throw new Error("Ya hay una solicitud o vacaciones aprobadas en esas fechas");
    }
    const v: Vacacion = {
      id: `v-${crypto.randomUUID().slice(0, 8)}`,
      empleado_id: input.empleado_id,
      desde: input.desde,
      hasta,
      dias_habiles: input.dias_habiles,
      estado: "solicitada",
      aprobada_por: null,
      notas: input.notas,
      creado_en: new Date().toISOString(),
    };
    this.store.vacaciones.push(v);
    return structuredClone(v);
  }

  async decidirVacaciones(id: string, aprobar: boolean, nota?: string): Promise<void> {
    const v = this.store.vacaciones.find((x) => x.id === id);
    if (!v) throw new Error("Solicitud no encontrada");
    if (v.estado !== "solicitada") {
      throw new Error(`Esta solicitud ya está ${v.estado}`);
    }
    v.estado = aprobar ? "aprobada" : "rechazada";
    v.aprobada_por = "u-01"; // Admin (en producción: auth.uid() con rol Admin)
    if (nota) v.notas = v.notas ? `${v.notas} · ${nota}` : nota;
  }

  async listarEvaluaciones(ciclo?: string): Promise<EvaluacionCard[]> {
    return this.store.evaluaciones
      .filter((ev) => !ciclo || ev.ciclo === ciclo)
      .sort((a, b) => b.ciclo.localeCompare(a.ciclo) || (b.puntaje ?? 0) - (a.puntaje ?? 0))
      .map((ev) => ({
        evaluacion: structuredClone(ev),
        empleado: EMPLEADOS.find((e) => e.id === ev.empleado_id)!,
        evaluador: USUARIOS.find((u) => u.id === ev.evaluador_id) ?? null,
      }));
  }

  async listarCiclos(): Promise<string[]> {
    return [...new Set(this.store.evaluaciones.map((e) => e.ciclo))].sort().reverse();
  }

  async guardarEvaluacion(
    id: string,
    datos: {
      criterios: { nombre: string; puntaje: number }[];
      estado: Evaluacion["estado"];
    },
  ): Promise<void> {
    const ev = this.store.evaluaciones.find((x) => x.id === id);
    if (!ev) throw new Error("Evaluación no encontrada");
    for (const c of datos.criterios) {
      if (c.puntaje < 0 || c.puntaje > 5) {
        throw new Error(`El puntaje de "${c.nombre}" debe estar entre 0 y 5`);
      }
    }
    ev.criterios = datos.criterios;
    ev.estado = datos.estado;
    ev.puntaje =
      datos.criterios.length > 0
        ? Math.round(
            (datos.criterios.reduce((a, c) => a + c.puntaje, 0) /
              datos.criterios.length) *
              100,
          ) / 100
        : null;
    ev.evaluador_id = "u-01";
  }

  async listarVacantes(): Promise<VacanteCard[]> {
    return this.store.vacantes
      .filter((v) => v.activo)
      .sort((a, b) => (a.estado === "abierta" ? 0 : 1) - (b.estado === "abierta" ? 0 : 1))
      .map((v) => ({
        vacante: structuredClone(v),
        aplicaciones: this.store.aplicaciones
          .filter((a) => a.vacante_id === v.id)
          .sort((a, b) => a.creado_en.localeCompare(b.creado_en)),
      }));
  }

  async crearVacante(cargo: string, area: string | null): Promise<Vacante> {
    if (!cargo.trim()) throw new Error("Escriba el cargo de la vacante");
    const v: Vacante = {
      id: `va-${crypto.randomUUID().slice(0, 8)}`,
      cargo: cargo.trim(),
      area,
      estado: "abierta",
      publicada_en: hoyISO(),
      activo: true,
      eliminado_en: null,
    };
    this.store.vacantes.push(v);
    return structuredClone(v);
  }

  async moverAplicacion(id: string, etapa: Aplicacion["etapa"]): Promise<void> {
    const a = this.store.aplicaciones.find((x) => x.id === id);
    if (!a) throw new Error("Aplicación no encontrada");
    a.etapa = etapa;
  }

  async agregarAplicacion(input: {
    vacante_id: string;
    nombre: string;
    contacto: string | null;
  }): Promise<Aplicacion> {
    if (!input.nombre.trim()) throw new Error("Escriba el nombre del aspirante");
    const a: Aplicacion = {
      id: `ap-${crypto.randomUUID().slice(0, 8)}`,
      vacante_id: input.vacante_id,
      nombre: input.nombre.trim(),
      contacto: input.contacto,
      etapa: "aplico",
      cv_url: null,
      creado_en: new Date().toISOString(),
    };
    this.store.aplicaciones.push(a);
    return structuredClone(a);
  }
}

export function getRrhhRepository(): RrhhRepository {
  g.__rrhhRepositorio ??= new MockRrhhRepository();
  return g.__rrhhRepositorio;
}
