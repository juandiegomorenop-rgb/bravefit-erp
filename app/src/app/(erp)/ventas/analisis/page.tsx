import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Análisis de ventas" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Análisis de ventas"
      subtitulo="Dimensiones: cliente, vendedor, producto, ciudad, canal, propio vs comercializado y B2B vs B2C."
    />
  );
}
