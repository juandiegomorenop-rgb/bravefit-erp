/**
 * Datos mock COMPARTIDOS de materiales — los consumen Inventarios
 * (existencias/kardex/buffers) y Compras (solicitudes/recepciones).
 * Espejo de tipos_material (seed.sql) y materiales (esquema).
 * Buffers min/max = reposición por consumo (Simple Solutions).
 */

import type { Material, Proveedor, TipoMaterial } from "@/lib/types/db";

/** 1:1 con seed.sql. */
export const TIPOS_MATERIAL: TipoMaterial[] = [
  { id: 1, nombre: "Tubería" },
  { id: 2, nombre: "Platinería" },
  { id: 3, nombre: "Cojinería" },
  { id: 4, nombre: "Tornillería" },
  { id: 5, nombre: "Plásticos de ingeniería" },
  { id: 6, nombre: "Insumos" },
  { id: 7, nombre: "Pintura" },
  { id: 8, nombre: "Otros" },
];

function mat(
  id: string,
  nombre: string,
  tipo_material_id: number,
  unidad_id: number, // 1=und · 2=m · 3=kg · 4=gl
  costo_promedio: number,
  buffer_min: number,
  buffer_max: number,
): Material {
  return {
    id,
    nombre,
    tipo_material_id,
    unidad_id,
    costo_promedio,
    buffer_min,
    buffer_max,
    activo: true,
    eliminado_en: null,
  };
}

export const MATERIALES: Material[] = [
  // Tubería (m)
  mat("m-01", "Tubo cuadrado 7×7 cm cal. 11", 1, 2, 38_500, 60, 240),
  mat("m-02", "Tubo cuadrado 5×5 cm cal. 14", 1, 2, 21_300, 40, 160),
  mat("m-03", "Tubo redondo 1½\" cal. 14", 1, 2, 14_800, 30, 120),
  // Platinería (und/kg)
  mat("m-04", "Platina 3/8\" × 2\" (lámina HR)", 2, 3, 6_900, 80, 300),
  mat("m-05", "Lámina HR 9 mm (corte láser J-Lock)", 2, 3, 7_400, 50, 200),
  // Cojinería (und)
  mat("m-06", "Tapizado banco plano (cuerina + espuma)", 3, 1, 92_000, 6, 24),
  mat("m-07", "Tapizado banco ajustable", 3, 1, 118_000, 4, 16),
  // Tornillería (und)
  mat("m-08", "Tornillo hexagonal 5/8\" × 4\" grado 5", 4, 1, 3_800, 200, 800),
  mat("m-09", "Tuerca de seguridad 5/8\"", 4, 1, 950, 200, 800),
  mat("m-10", "Anclaje expansivo 1/2\" × 3¾\"", 4, 1, 4_600, 100, 400),
  // Plásticos de ingeniería (und)
  mat("m-11", "UHMW protector J-Lock (par)", 5, 1, 28_000, 20, 80),
  mat("m-12", "Tapón interno 7×7 (polipropileno)", 5, 1, 2_100, 100, 400),
  // Insumos (und/kg)
  mat("m-13", "Alambre MIG ER70S-6 (rollo 15 kg)", 6, 1, 148_000, 2, 8),
  mat("m-14", "Disco de corte 14\"", 6, 1, 12_500, 15, 60),
  // Pintura (kg)
  mat("m-15", "Pintura electrostática negro mate", 7, 3, 26_800, 25, 100),
  mat("m-16", "Pintura electrostática roja RAL 3020", 7, 3, 31_500, 8, 40),
];

export const PROVEEDORES: Proveedor[] = [
  { id: "pr-01", nombre: "Aceros y Perfiles del Valle", nit: "890.900.111-2", contacto: "Andrés Zapata", telefono: "604 372 1122", email: "ventas@acerosvalle.co", activo: true },
  { id: "pr-02", nombre: "Ferretería Industrial FerreMax", nit: "901.222.333-4", contacto: "Diana Cárdenas", telefono: "604 448 9900", email: "pedidos@ferremax.co", activo: true },
  { id: "pr-03", nombre: "Pinturas Electrostáticas Andinas", nit: "800.555.666-7", contacto: "Jorge Mira", telefono: "604 285 4433", email: "comercial@pinturasandinas.co", activo: true },
  { id: "pr-04", nombre: "Tapizados y Espumas El Cojín", nit: "901.777.888-9", contacto: "Luz Marina Ríos", telefono: "310 665 2211", email: "elcojin@gmail.com", activo: true },
];
