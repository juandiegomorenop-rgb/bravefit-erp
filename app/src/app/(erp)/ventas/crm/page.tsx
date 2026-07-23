import {
  getCotizacionesRepository,
  getCrmRepository,
  listarCiudades,
} from "@/lib/data/crm-cotizaciones-server";
import { CrmClient } from "./CrmClient";

export const metadata = { title: "CRM — Embudo de ventas" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/**
 * Server component: carga oportunidades, etapas y vendedores (hoy mock,
 * mañana Supabase) y delega el embudo interactivo al client component.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getCrmRepository();
  const [cards, etapas, vendedores, clientes, ciudades] = await Promise.all([
    repo.listarOportunidades(),
    repo.listarEtapas(),
    repo.listarVendedores(),
    getCotizacionesRepository().listarClientes(),
    listarCiudades(),
  ]);

  return (
    <CrmClient
      cardsIniciales={cards}
      etapas={etapas}
      vendedores={vendedores}
      clientes={clientes}
      ciudades={ciudades}
      filtrosIniciales={{
        vendedor_id: primero(sp.vendedor) || undefined,
        texto: primero(sp.q) ?? "",
      }}
    />
  );
}
