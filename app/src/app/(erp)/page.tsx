import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Dashboard"
      subtitulo="Resumen general del negocio: ventas, producción, finanzas, mercadeo y operación."
    />
  );
}
