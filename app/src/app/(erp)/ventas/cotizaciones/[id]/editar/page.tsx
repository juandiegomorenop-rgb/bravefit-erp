import { redirect } from "next/navigation";
import {
  getCotizacionesRepository,
  listarCategoriasProducto,
  listarCiudades,
  listarDimensiones,
  listarProductosCatalogo,
} from "@/lib/data/crm-cotizaciones-server";
import { EditorCotizacion } from "../../EditorCotizacion";

export const metadata = { title: "Editar cotización" };

/** Borradores Y Enviadas se editan (regla de Juan: los ajustes que
 *  pida el cliente no deben exigir duplicar); el resto va al detalle. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = getCotizacionesRepository();
  const det = await repo.obtener(id);
  if (!det) redirect("/ventas/cotizaciones");
  if (det.estado.nombre !== "Borrador" && det.estado.nombre !== "Enviada")
    redirect(`/ventas/cotizaciones/${id}`);

  const [clientes, vendedores, productos, dimensiones, categorias, ciudades] =
    await Promise.all([
      repo.listarClientes(),
      repo.listarVendedores(),
      listarProductosCatalogo(),
      listarDimensiones(),
      listarCategoriasProducto(),
      listarCiudades(),
    ]);

  return (
    <EditorCotizacion
      clientes={clientes}
      vendedores={vendedores}
      productos={productos}
      dimensiones={dimensiones}
      categorias={categorias}
      ciudades={ciudades}
      cotizacionId={det.cotizacion.id}
      numero={det.cotizacion.numero}
      inicial={{
        cliente_id: det.cotizacion.cliente_id,
        vendedor_id: det.cotizacion.vendedor_id,
        origen: det.cotizacion.origen,
        segmento: det.cotizacion.segmento,
        no_facturar: det.cotizacion.no_facturar,
        pago_anticipado_completo: det.cotizacion.pago_anticipado_completo,
        descuento_pct: det.cotizacion.descuento_pct,
        tiempo_entrega: det.cotizacion.tiempo_entrega,
        notas: det.cotizacion.notas,
        items: det.items.map((i) => ({
          producto_id: i.producto_id,
          descripcion: i.descripcion,
          es_transporte: i.es_transporte,
          aplica_iva: i.aplica_iva,
          cantidad: i.cantidad,
          precio_unit: i.precio_unit,
          descuento_pct: i.descuento_pct,
          alto_override_cm: i.alto_override_cm,
          fondo_override_cm: i.fondo_override_cm,
          color: i.color,
          recargos: i.recargos,
        })),
      }}
    />
  );
}
