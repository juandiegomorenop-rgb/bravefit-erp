import { getShopifyRepository, type PeriodoClave } from "@/lib/data/shopify";
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

  return <ShopifyClient pedidos={pedidos} analitica={analitica} periodo={periodo} />;
}
