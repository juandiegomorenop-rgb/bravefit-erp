import { getMercadeoRepository, type RangoFechas } from "@/lib/data/mercadeo";
import { MercadeoClient } from "./MercadeoClient";

export const metadata = { title: "Mercadeo" };

type SearchParams = Record<string, string | string[] | undefined>;

const primero = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Rango a partir de un preset (7/30/90 días). */
function rangoDe(dias: number): RangoFechas {
  const hasta = new Date();
  hasta.setHours(0, 0, 0, 0);
  const desde = new Date(hasta.getTime() - (dias - 1) * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: iso(desde), hasta: iso(hasta) };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const dias = Number(primero(sp.dias)) || 30;
  const rango = rangoDe([7, 30, 90].includes(dias) ? dias : 30);

  const repo = getMercadeoRepository();
  const [canales, categorias, contenido, pauta, embudo, cacRoas, pruebas] =
    await Promise.all([
      repo.listarCanales(),
      repo.categorias(),
      repo.rendimientoContenido(rango), // agregado del rango; el cliente sub-filtra
      repo.pautaPorCanal(rango),
      repo.embudoLeads(rango),
      repo.cacRoas(rango),
      repo.listarPruebas(),
    ]);

  return (
    <MercadeoClient
      dias={[7, 30, 90].includes(dias) ? dias : 30}
      rango={rango}
      canales={canales}
      categorias={categorias}
      contenido={contenido}
      pauta={pauta}
      embudo={embudo}
      cacRoas={cacRoas}
      pruebas={pruebas}
    />
  );
}
