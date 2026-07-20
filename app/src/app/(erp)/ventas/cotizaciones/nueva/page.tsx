import {
  getCotizacionesRepository,
  listarCategoriasProducto,
  listarCiudades,
  listarDimensiones,
  listarProductosCatalogo,
} from "@/lib/data/crm-cotizaciones-server";
import { EditorCotizacion } from "../EditorCotizacion";

export const metadata = { title: "Nueva cotización" };

type SearchParams = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Acepta prefill desde el CRM (`?cliente=&vendedor=&oportunidad=`):
 * cotizar una oportunidad existente arranca con su cliente y vendedor,
 * y al guardar la cotización se vincula a ESA oportunidad en vez de
 * crear otra tarjeta en el embudo.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getCotizacionesRepository();
  const [clientes, vendedores, productos, dimensiones, categorias, ciudades] =
    await Promise.all([
      repo.listarClientes(),
      repo.listarVendedores(),
      listarProductosCatalogo(),
      listarDimensiones(),
      listarCategoriasProducto(),
      listarCiudades(),
    ]);

  const clienteId = primero(sp.cliente);
  const vendedorId = primero(sp.vendedor);
  const oportunidadId = primero(sp.oportunidad);
  const prefill =
    clienteId && clientes.some((c) => c.id === clienteId)
      ? {
          cliente_id: clienteId,
          vendedor_id:
            vendedorId && vendedores.some((v) => v.id === vendedorId)
              ? vendedorId
              : "",
        }
      : undefined;

  return (
    <EditorCotizacion
      clientes={clientes}
      vendedores={vendedores}
      productos={productos}
      dimensiones={dimensiones}
      categorias={categorias}
      ciudades={ciudades}
      prefill={prefill}
      oportunidadId={oportunidadId}
    />
  );
}
