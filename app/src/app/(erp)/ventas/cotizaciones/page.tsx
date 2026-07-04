import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Cotizaciones" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Cotizaciones"
      subtitulo="Numeración BFP-NNNN, segmento B2B/B2C obligatorio y flag de no facturar."
    />
  );
}
