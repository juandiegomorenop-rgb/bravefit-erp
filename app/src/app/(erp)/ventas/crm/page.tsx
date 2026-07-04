import { PaginaModulo } from "@/components/PaginaModulo";

export const metadata = { title: "CRM · Embudo" };

export default function Page() {
  return (
    <PaginaModulo
      titulo="CRM · Embudo"
      subtitulo="Oportunidades por etapa con arrastrar y soltar. Al ganar se genera O.P. automática."
    />
  );
}
