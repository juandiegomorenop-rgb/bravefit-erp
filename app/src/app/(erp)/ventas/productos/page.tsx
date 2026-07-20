import { getProductosRepository } from "@/lib/data/productos-server";
import { ProductosClient } from "./ProductosClient";

export const metadata = { title: "Lista de productos" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Server component: carga el catálogo maestro + categorías (hoy mock,
 * mañana Supabase) y delega filtros/grid al client component.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getProductosRepository();
  const [cards, categorias] = await Promise.all([
    repo.listar(),
    repo.listarCategorias(),
  ]);

  const clasif = primero(sp.clasif);
  const origen = primero(sp.origen);
  return (
    <ProductosClient
      cardsIniciales={cards}
      categorias={categorias}
      filtrosIniciales={{
        categoria_id: Number(primero(sp.cat)) || undefined,
        clasificacion:
          clasif === "MTS" || clasif === "ATO" || clasif === "MTO"
            ? clasif
            : undefined,
        origen:
          origen === "propio" || origen === "comercializado"
            ? origen
            : undefined,
        texto: primero(sp.q) ?? "",
      }}
    />
  );
}
