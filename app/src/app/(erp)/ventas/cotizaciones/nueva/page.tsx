import { getCotizacionesRepository } from "@/lib/data/crm-cotizaciones";
import { PRODUCTO_DIMENSIONES, PRODUCTOS } from "@/lib/data/ops";
import { EditorCotizacion } from "../EditorCotizacion";

export const metadata = { title: "Nueva cotización" };

export default async function Page() {
  const repo = getCotizacionesRepository();
  const [clientes, vendedores] = await Promise.all([
    repo.listarClientes(),
    repo.listarVendedores(),
  ]);
  return (
    <EditorCotizacion
      clientes={clientes}
      vendedores={vendedores}
      productos={PRODUCTOS.filter((p) => p.activo)}
      dimensiones={PRODUCTO_DIMENSIONES}
    />
  );
}
