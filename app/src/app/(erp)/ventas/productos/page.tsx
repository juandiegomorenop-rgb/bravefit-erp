import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Lista de productos" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Lista de productos"
      subtitulo="Catálogo maestro con SKU dual (Bravefit/Siigo) y clasificación MTS · ATO · MTO."
    />
  );
}
