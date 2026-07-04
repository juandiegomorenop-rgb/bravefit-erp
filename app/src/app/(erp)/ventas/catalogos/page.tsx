import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Catálogos" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Catálogos"
      subtitulo="Catálogos compartibles por categoría con portada y exportación a PDF."
    />
  );
}
