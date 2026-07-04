import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Entregas" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Entregas"
      subtitulo="KPIs de mes, año, récord y promedio sobre O.P. entregadas."
    />
  );
}
