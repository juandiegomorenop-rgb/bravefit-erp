import { getRrhhRepository } from "@/lib/data/rrhh";
import { EvaluacionesClient } from "./EvaluacionesClient";

export const metadata = { title: "Evaluaciones" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const repo = getRrhhRepository();
  const ciclos = await repo.listarCiclos();

  const cicloParam = primero(sp.ciclo);
  const ciclo =
    cicloParam && ciclos.includes(cicloParam) ? cicloParam : (ciclos[0] ?? null);
  const cards = ciclo ? await repo.listarEvaluaciones(ciclo) : [];

  return <EvaluacionesClient cards={cards} ciclos={ciclos} ciclo={ciclo} />;
}
