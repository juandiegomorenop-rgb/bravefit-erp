import type { Modulo } from "@/lib/permisos";

/**
 * Navegación DATA-DRIVEN del ERP (requisito: agregar módulos/submenús
 * no debe requerir refactor). El menú se filtra con filtrarNav(NAV, permisos).
 */

export interface NavChild {
  label: string;
  href: string;
  modulo: Modulo;
}

export interface NavItem {
  label: string;
  href: string;
  modulo: Modulo;
  children?: NavChild[];
}

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", modulo: "dashboard" },
  {
    label: "Ventas",
    href: "/ventas/cotizaciones",
    modulo: "ventas",
    children: [
      { label: "Cotizaciones", href: "/ventas/cotizaciones", modulo: "ventas" },
      { label: "CRM · Embudo", href: "/ventas/crm", modulo: "ventas" },
      { label: "Lista de productos", href: "/ventas/productos", modulo: "ventas" },
      { label: "Catálogos", href: "/ventas/catalogos", modulo: "ventas" },
      { label: "Pedidos web · Shopify", href: "/ventas/shopify", modulo: "ventas" },
      { label: "Análisis de ventas", href: "/ventas/analisis", modulo: "ventas" },
    ],
  },
  {
    label: "Producción y Logística",
    href: "/produccion/ordenes",
    modulo: "produccion",
    children: [
      { label: "Inventarios", href: "/produccion/inventarios", modulo: "produccion" },
      { label: "Órdenes de pedido", href: "/produccion/ordenes", modulo: "produccion" },
      { label: "Solicitudes de compra", href: "/produccion/compras", modulo: "produccion" },
      { label: "Garantías", href: "/produccion/garantias", modulo: "produccion" },
      { label: "Entregas", href: "/produccion/entregas", modulo: "produccion" },
    ],
  },
  { label: "Mercadeo", href: "/mercadeo", modulo: "mercadeo" },
  {
    label: "Recursos Humanos",
    href: "/rrhh/empleados",
    modulo: "rrhh",
    children: [
      { label: "Empleados", href: "/rrhh/empleados", modulo: "rrhh" },
      { label: "Vacaciones", href: "/rrhh/vacaciones", modulo: "rrhh" },
      { label: "Evaluaciones", href: "/rrhh/evaluaciones", modulo: "rrhh" },
      { label: "Reclutamiento", href: "/rrhh/reclutamiento", modulo: "rrhh" },
    ],
  },
  { label: "Cartelera", href: "/cartelera", modulo: "cartelera" },
];
