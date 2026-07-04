import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Empleados" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Empleados"
      subtitulo="Lista maestro-detalle con hoja de vida resumida y PDF adjunto."
    />
  );
}
