import { getRrhhRepository } from "@/lib/data/rrhh";
import { EmpleadosClient, type FiltrosEmpleados } from "./EmpleadosClient";

export const metadata = { title: "Empleados" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const cards = await getRrhhRepository().listarEmpleados();

  const area = primero(sp.area);
  const filtros: FiltrosEmpleados = {
    area: area === "planta" || area === "administración" ? area : undefined,
    solo_tecnicos: primero(sp.tecnicos) === "1",
    texto: primero(sp.q) ?? "",
  };
  return <EmpleadosClient cards={cards} filtrosIniciales={filtros} />;
}
