/**
 * Capa de datos de CATÁLOGOS DE VENTA (submódulo de Ventas).
 *
 * Un catálogo es un DOCUMENTO VERSIONADO: cada vez que se actualiza se sube una
 * versión nueva y la de MAYOR número pasa a ser la ACTUAL. Los vendedores
 * siempre consumen la actual (así nunca comparten una lista de precios vieja);
 * las versiones anteriores quedan como historial.
 *
 * Mock: los archivos son data URLs (un PDF de ejemplo en el seed; los subidos
 * por el vendedor llegan como data URL desde el navegador). En producción el
 * archivo vive en el bucket 'catalogos' de Storage y `archivo_url` es su ruta;
 * el swap = implementar SupabaseCatalogosRepository y cambiar UNA línea.
 */

import { USUARIOS, tsRel } from "@/lib/data/ops";
import type { Catalogo, CatalogoVersion, Usuario } from "@/lib/types/db";

/** Usuario que sube versiones en el mock (en prod = auth.uid()). */
const USUARIO_ACTUAL = "u-01";

/** PDF mínimo válido de ejemplo (portada "Catálogo Bravefit"). */
export const PDF_DEMO =
  "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvTWVkaWFCb3ggWzAgMCA0MjAgMjAwXSAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggMTA4ID4+CnN0cmVhbQpCVCAvRjEgMjAgVGYgNDAgMTIwIFRkIChDYXRhbG9nbyBCcmF2ZWZpdCkgVGogL0YxIDEyIFRmIDAgLTMwIFRkIChEb2N1bWVudG8gZGUgZWplbXBsbyAtIEVSUCBCcmF2ZWZpdCkgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMxMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ3MAolJUVPRg==";

// ---------------------------------------------------------------
// Vistas expuestas a la UI
// ---------------------------------------------------------------

export interface VersionConAutor extends CatalogoVersion {
  autor: Usuario | null;
}

export interface CatalogoCard {
  catalogo: Catalogo;
  actual: VersionConAutor | null; // versión de mayor número (la vigente)
  total_versiones: number;
}

export interface CatalogoDetalle {
  catalogo: Catalogo;
  versiones: VersionConAutor[]; // descendente por versión (actual primero)
}

export interface NuevaVersionInput {
  archivo_nombre: string;
  archivo_url: string; // data URL en mock / ruta de Storage en prod
  tamano_bytes: number | null;
  notas: string | null;
}

export interface NuevoCatalogoInput {
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  primeraVersion: NuevaVersionInput;
}

export interface CatalogosRepository {
  listar(): Promise<CatalogoCard[]>;
  obtener(id: string): Promise<CatalogoDetalle | null>;
  crear(input: NuevoCatalogoInput): Promise<{ id: string }>;
  subirVersion(catalogo_id: string, input: NuevaVersionInput): Promise<{ version: number }>;
}

/** Categorías sugeridas (editables; el input acepta texto libre). */
export const CATEGORIAS_CATALOGO = [
  "General",
  "Racks",
  "Cardio",
  "Fuerza",
  "Accesorios",
  "Lista de precios",
];

// ===============================================================
// MOCK
// ===============================================================

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface SeedCat {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  versiones: { por: string; dias: number; notas: string; kb: number }[];
}

const SEED: SeedCat[] = [
  {
    id: "cat-01",
    nombre: "Catálogo general 2026",
    categoria: "General",
    descripcion: "Portafolio completo de equipos Bravefit con fotos y especificaciones.",
    versiones: [
      { por: "u-01", dias: -120, notas: "Versión inicial 2026.", kb: 2450 },
      { por: "u-03", dias: -45, notas: "Se agregan 6 productos nuevos y se actualizan fotos.", kb: 2680 },
      { por: "u-01", dias: -6, notas: "Corrección de medidas del Rack PF5 y nuevos colores.", kb: 2710 },
    ],
  },
  {
    id: "cat-02",
    nombre: "Racks y jaulas",
    categoria: "Racks",
    descripcion: "Línea de racks, power cages y rigs modulares.",
    versiones: [
      { por: "u-02", dias: -80, notas: "Primer catálogo dedicado a racks.", kb: 1320 },
      { por: "u-02", dias: -12, notas: "Se incluye el rig modular de 4 estaciones.", kb: 1510 },
    ],
  },
  {
    id: "cat-03",
    nombre: "Lista de precios",
    categoria: "Lista de precios",
    descripcion: "Precios de lista vigentes (con IVA). Uso interno del equipo comercial.",
    versiones: [
      { por: "u-01", dias: -30, notas: "Precios junio.", kb: 180 },
      { por: "u-01", dias: -2, notas: "Ajuste de precios julio por costo de tubería.", kb: 184 },
    ],
  },
  {
    id: "cat-04",
    nombre: "Cardio y accesorios",
    categoria: "Cardio",
    descripcion: "Bandas, poleas, accesorios funcionales y línea de cardio comercializada.",
    versiones: [{ por: "u-03", dias: -18, notas: "Catálogo inicial de la línea cardio.", kb: 990 }],
  },
];

function construirSeed(): { catalogos: Catalogo[]; versiones: CatalogoVersion[] } {
  const catalogos: Catalogo[] = [];
  const versiones: CatalogoVersion[] = [];
  for (const s of SEED) {
    catalogos.push({
      id: s.id,
      nombre: s.nombre,
      descripcion: s.descripcion,
      categoria: s.categoria,
      portada_url: null,
      publicado: true,
      activo: true,
      eliminado_en: null,
      creado_en: tsRel(s.versiones[0].dias, 9),
    });
    s.versiones.forEach((v, i) => {
      versiones.push({
        id: `${s.id}-v${i + 1}`,
        catalogo_id: s.id,
        version: i + 1,
        archivo_url: PDF_DEMO,
        archivo_nombre: `${slug(s.nombre)}-v${i + 1}.pdf`,
        tamano_bytes: v.kb * 1024,
        notas: v.notas,
        subido_por: v.por,
        subido_en: tsRel(v.dias, 10 + i),
      });
    });
  }
  return { catalogos, versiones };
}

function autor(id: string | null): Usuario | null {
  return USUARIOS.find((u) => u.id === id) ?? null;
}

export class MockCatalogosRepository implements CatalogosRepository {
  private catalogos: Catalogo[];
  private versiones: CatalogoVersion[];

  constructor() {
    const seed = construirSeed();
    this.catalogos = seed.catalogos;
    this.versiones = seed.versiones;
  }

  private versionesDe(catalogo_id: string): CatalogoVersion[] {
    return this.versiones
      .filter((v) => v.catalogo_id === catalogo_id)
      .sort((a, b) => b.version - a.version);
  }

  async listar(): Promise<CatalogoCard[]> {
    return this.catalogos
      .filter((c) => c.activo)
      .map((catalogo) => {
        const vs = this.versionesDe(catalogo.id);
        const actual = vs[0] ?? null;
        return {
          catalogo: structuredClone(catalogo),
          actual: actual ? { ...structuredClone(actual), autor: autor(actual.subido_por) } : null,
          total_versiones: vs.length,
        };
      })
      .sort((a, b) => a.catalogo.nombre.localeCompare(b.catalogo.nombre));
  }

  async obtener(id: string): Promise<CatalogoDetalle | null> {
    const catalogo = this.catalogos.find((c) => c.id === id && c.activo);
    if (!catalogo) return null;
    return structuredClone({
      catalogo,
      versiones: this.versionesDe(id).map((v) => ({ ...v, autor: autor(v.subido_por) })),
    });
  }

  async crear(input: NuevoCatalogoInput): Promise<{ id: string }> {
    const nombre = input.nombre.trim();
    if (!nombre) throw new Error("El catálogo necesita un nombre.");
    const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
    const ahora = new Date().toISOString();
    this.catalogos.push({
      id,
      nombre,
      descripcion: input.descripcion?.trim() || null,
      categoria: input.categoria?.trim() || null,
      portada_url: null,
      publicado: true,
      activo: true,
      eliminado_en: null,
      creado_en: ahora,
    });
    this.agregarVersion(id, input.primeraVersion, 1, ahora);
    return { id };
  }

  async subirVersion(catalogo_id: string, input: NuevaVersionInput): Promise<{ version: number }> {
    const catalogo = this.catalogos.find((c) => c.id === catalogo_id && c.activo);
    if (!catalogo) throw new Error("El catálogo no existe.");
    const actual = this.versionesDe(catalogo_id)[0];
    const version = (actual?.version ?? 0) + 1;
    this.agregarVersion(catalogo_id, input, version, new Date().toISOString());
    return { version };
  }

  private agregarVersion(
    catalogo_id: string,
    input: NuevaVersionInput,
    version: number,
    en: string,
  ) {
    const nombre = input.archivo_nombre.trim();
    if (!input.archivo_url) throw new Error("Falta el archivo del catálogo.");
    this.versiones.push({
      id: `${catalogo_id}-v${version}-${crypto.randomUUID().slice(0, 6)}`,
      catalogo_id,
      version,
      archivo_url: input.archivo_url,
      archivo_nombre: nombre || `catalogo-v${version}.pdf`,
      tamano_bytes: input.tamano_bytes,
      notas: input.notas?.trim() || null,
      subido_por: USUARIO_ACTUAL,
      subido_en: en,
    });
  }
}

// ---------------------------------------------------------------
// Factory (globalThis singleton — sobrevive HMR)
// ---------------------------------------------------------------

const g = globalThis as unknown as { __catalogosRepo?: CatalogosRepository };

export function getCatalogosRepository(): CatalogosRepository {
  g.__catalogosRepo ??= new MockCatalogosRepository();
  return g.__catalogosRepo;
}
