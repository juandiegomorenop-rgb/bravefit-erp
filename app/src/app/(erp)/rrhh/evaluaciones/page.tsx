import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Evaluaciones" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Evaluaciones"
      subtitulo="Evaluaciones de desempeño por ciclo con puntaje sobre 5."
    />
  );
}
