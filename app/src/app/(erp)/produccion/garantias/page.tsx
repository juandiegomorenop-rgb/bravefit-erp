import { getOpsRepository } from "@/lib/data/ops-server";
import { type GarantiaFiltros, USUARIOS } from "@/lib/data/ops";
import { GarantiasClient } from "./GarantiasClient";

export const metadata = { title: "Garantías" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getOpsRepository();
  const [cards, ops] = await Promise.all([
    repo.listarGarantias(),
    repo.listarOps(),
  ]);

  const estadoParam = primero(sp.estado);
  return (
    <GarantiasClient
      cards={cards}
      // una garantía nace de una OP (normalmente ya entregada): solo tipo 'op'
      opsParaGarantia={ops.filter((o) => o.tipo === "op")}
      usuarios={USUARIOS}
      filtrosIniciales={{
        estado:
          estadoParam === "abiertas" || estadoParam === "cerradas"
            ? (estadoParam as GarantiaFiltros["estado"])
            : undefined,
        texto: primero(sp.q) ?? "",
      }}
      opPreseleccionada={primero(sp.nueva)}
    />
  );
}
