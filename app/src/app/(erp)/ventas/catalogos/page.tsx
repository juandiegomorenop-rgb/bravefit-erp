import { getCatalogosRepository } from "@/lib/data/catalogos";
import { PERMISOS_ADMIN } from "@/lib/permisos";
import { AvisoEjemplo } from "@/components/AvisoEjemplo";
import { CatalogosClient } from "./CatalogosClient";

export const metadata = { title: "Catálogos" };

export default async function Page() {
  const catalogos = await getCatalogosRepository().listar();
  // TODO fase 1: permisos reales del rol; hoy Admin puede subir/editar.
  const puedeEditar =
    PERMISOS_ADMIN.find((p) => p.modulo === "ventas")?.puede_editar ?? false;

  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-6 sm:px-6">
        <AvisoEjemplo detalle="Los PDF que ves son de muestra; los catálogos reales se subirán al conectar el módulo." />
      </div>
      <CatalogosClient catalogos={catalogos} puedeEditar={puedeEditar} />
    </>
  );
}
