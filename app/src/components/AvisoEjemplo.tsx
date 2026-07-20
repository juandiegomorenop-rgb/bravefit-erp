/**
 * Banner para módulos que aún muestran datos de demostración — evita
 * que alguien lea cifras mock como reales mientras se conectan a
 * Supabase (se retira al hacer el swap del módulo).
 */
export function AvisoEjemplo({ detalle }: { detalle?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-card border border-aviso-borde bg-aviso px-4 py-3">
      <span className="rounded-pill bg-carbon px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
        Datos de ejemplo
      </span>
      <span className="text-[13px] font-semibold text-aviso-texto">
        Este módulo aún no está conectado a los datos reales.
        {detalle ? ` ${detalle}` : ""}
      </span>
    </div>
  );
}
