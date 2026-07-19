import {
  getCotizacionesRepository,
  listarCategoriasProducto,
  listarDimensiones,
  listarProductosCatalogo,
} from "@/lib/data/crm-cotizaciones-server";
import { EditorCotizacion } from "../EditorCotizacion";

export const metadata = { title: "Nueva cotización" };

export default async function Page() {
  const repo = getCotizacionesRepository();
  const [clientes, vendedores, productos, dimensiones, categorias] =
    await Promise.all([
      repo.listarClientes(),
      repo.listarVendedores(),
      listarProductosCatalogo(),
      listarDimensiones(),
      listarCategoriasProducto(),
    ]);
  return (
    <EditorCotizacion
      clientes={clientes}
      vendedores={vendedores}
      productos={productos}
      dimensiones={dimensiones}
      categorias={categorias}
    />
  );
}
