import { getComprasRepository } from "@/lib/data/compras";
import type { FiltrosCompras } from "@/lib/data/compras";
import { ComprasClient } from "./ComprasClient";

export const metadata = { title: "Solicitudes de compra" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const ESTADOS_VALIDOS = ["pendiente", "en_cotizacion", "comprado", "rechazada"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getComprasRepository();
  const [cards, faltantes, tipos, materiales, proveedores] = await Promise.all([
    repo.listar(),
    repo.listarFaltantes(),
    repo.listarTiposMaterial(),
    repo.listarMateriales(),
    repo.listarProveedores(),
  ]);

  const estadoParam = primero(sp.estado);
  return (
    <ComprasClient
      cards={cards}
      faltantes={faltantes}
      tipos={tipos}
      materiales={materiales}
      proveedores={proveedores}
      filtrosIniciales={{
        estado: ESTADOS_VALIDOS.includes(estadoParam ?? "")
          ? (estadoParam as FiltrosCompras["estado"])
          : undefined,
        tipo_material_id: Number(primero(sp.tipo)) || undefined,
        texto: primero(sp.q) ?? "",
      }}
    />
  );
}
