import type { FiltrosCompras } from "@/lib/data/compras";
import { getComprasRepository } from "@/lib/data/compras-server";
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

  // Atajo "Sugerir SC" de Inventarios: ?sugerir=<material_id>&cantidad=<n>
  // → el formulario de nueva solicitud abre prellenado con ese material.
  const sugerirId = primero(sp.sugerir);
  const sugerirCant = Number(primero(sp.cantidad)) || 1;
  const materialSugerido = sugerirId
    ? (materiales.find((m) => m.id === sugerirId) ?? null)
    : null;

  return (
    <>
      <ComprasClient
        prefill={
          materialSugerido
            ? { material_id: materialSugerido.id, cantidad: sugerirCant }
            : undefined
        }
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
    </>
  );
}
