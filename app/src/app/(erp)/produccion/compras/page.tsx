import type { FiltrosCompras } from "@/lib/data/compras";
import {
  getComprasRepository,
  listarProveedorTipos,
  sugerirReposicion,
} from "@/lib/data/compras-server";
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

  // Atajo "Sugerir SC" de Inventarios: ?sugerir=<material_id> → el form
  // abre prellenado con ese material Y el resto del JUEGO (las demás
  // platinas de los mismos productos que estén en REPONER).
  const sugerirId = primero(sp.sugerir);
  const [sugerencias, proveedorTipos] = await Promise.all([
    sugerirId ? sugerirReposicion(sugerirId) : Promise.resolve([]),
    listarProveedorTipos(),
  ]);

  return (
    <>
      <ComprasClient
        prefill={
          sugerencias.length
            ? {
                items: sugerencias.map((s) => ({
                  material_id: s.material_id,
                  cantidad: s.cantidad,
                })),
                nota:
                  sugerencias.length > 1
                    ? `Reposición sugerida desde Inventarios: ${sugerencias[0].nombre} + juego (${sugerencias
                        .filter((s) => s.companero)
                        .map((s) => s.nombre)
                        .join(", ")}). Cantidades = óptimo − disponible.`
                    : `Reposición sugerida desde Inventarios: ${sugerencias[0].nombre} (óptimo − disponible).`,
              }
            : undefined
        }
        proveedorTipos={proveedorTipos}
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
