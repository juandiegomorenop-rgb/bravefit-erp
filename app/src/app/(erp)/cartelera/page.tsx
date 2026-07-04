import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "Cartelera" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="Cartelera"
      subtitulo="Muro interno: todos pueden publicar. Posts importantes, reacciones y próximos eventos."
    />
  );
}
