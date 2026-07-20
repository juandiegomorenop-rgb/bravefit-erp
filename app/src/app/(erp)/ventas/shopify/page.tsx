import { getShopifyRepository, type PeriodoClave } from "@/lib/data/shopify";
import { AvisoEjemplo } from "@/components/AvisoEjemplo";
import { ShopifyClient } from "./ShopifyClient";

export const metadata = { title: "Pedidos web · Shopify" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const pParam = primero(sp.periodo);
  const periodo: PeriodoClave =
    pParam === "90d" || pParam === "anio" ? pParam : "30d";

  const repo = getShopifyRepository();
  const [pedidos, analitica] = await Promise.all([
    repo.listarPedidos(),
    repo.analitica(periodo),
  ]);

  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 sm:px-6">
        <AvisoEjemplo detalle="Pedidos y analítica reales llegan con los webhooks de Shopify." />
      </div>
      <ShopifyClient
        pedidos={pedidos}
        analitica={analitica}
        periodo={periodo}
      />
    </>
  );
}
