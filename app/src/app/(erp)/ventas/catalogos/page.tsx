import { getCatalogosRepository } from "@/lib/data/catalogos";
import { PERMISOS_ADMIN } from "@/lib/permisos";
import { CatalogosClient } from "./CatalogosClient";

export const metadata = { title: "Catálogos" };

export default async function Page() {
  const catalogos = await getCatalogosRepository().listar();
  // TODO fase 1: permisos reales del rol; hoy Admin puede subir/editar.
  const puedeEditar =
    PERMISOS_ADMIN.find((p) => p.modulo === "ventas")?.puede_editar ?? false;

  return <CatalogosClient catalogos={catalogos} puedeEditar={puedeEditar} />;
}
