import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Solicitudes de compra" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Solicitudes de compra"
      subtitulo="Renglones por tipo de material, expandibles, con recepción ítem por ítem."
    />
  );
}
