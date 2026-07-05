import { getCotizacionesRepository } from "@/lib/data/crm-cotizaciones";
import { CotizacionesClient } from "./CotizacionesClient";

export const metadata = { title: "Cotizaciones" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Server component: carga cotizaciones + catálogos (hoy mock, mañana
 * Supabase) y delega filtros/tabla al client component.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getCotizacionesRepository();
  const [cards, estados, vendedores] = await Promise.all([
    repo.listar(),
    repo.listarEstados(),
    repo.listarVendedores(),
  ]);

  const segmento = primero(sp.segmento);
  return (
    <CotizacionesClient
      cardsIniciales={cards}
      estados={estados}
      vendedores={vendedores}
      filtrosIniciales={{
        estado_id: Number(primero(sp.estado)) || undefined,
        vendedor_id: primero(sp.vendedor) || undefined,
        segmento: segmento === "B2B" || segmento === "B2C" ? segmento : undefined,
        texto: primero(sp.q) ?? "",
      }}
    />
  );
}
