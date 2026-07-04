import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Vacaciones" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Vacaciones"
      subtitulo="Solicitudes y aprobaciones con días hábiles L–V y festivos de Colombia."
    />
  );
}
