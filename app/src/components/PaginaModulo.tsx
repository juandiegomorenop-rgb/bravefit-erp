/** Placeholder estándar de módulo: título 26px/700 + subtítulo gris + card vacía. */
export function PaginaModulo({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <h1 className="text-[26px] font-bold leading-tight text-carbon">{titulo}</h1>
      <p className="mt-1 text-[14px] text-neutro">{subtitulo}</p>

      <div className="mt-6 flex min-h-64 items-center justify-center rounded-card border border-borde bg-card">
        <div className="text-center">
          <p className="text-[15px] font-bold text-carbon">Módulo en construcción</p>
          <p className="mt-1 text-[13px] text-neutro">
            Esta pantalla se implementará en una fase posterior.
          </p>
        </div>
      </div>
    </div>
  );
}
