/** Badges de estado de cotización (server-safe, sin estado). */

const ESTILO_ESTADO: Record<string, string> = {
  Borrador: "bg-neutro-bg text-neutro",
  Enviada: "bg-azul-bg text-azul",
  Aprobada: "bg-verde-bg text-verde",
  Vencida: "bg-ambar-bg text-ambar",
  Anulada: "bg-rojo-bg text-rojo line-through",
};

export function BadgeEstadoCotizacion({
  nombre,
  vencida = false,
}: {
  nombre: string;
  vencida?: boolean;
}) {
  // Enviada/Borrador que ya expiró: se muestra como vencida sin perder su estado
  const mostrar = vencida && (nombre === "Borrador" || nombre === "Enviada");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${
          ESTILO_ESTADO[nombre] ?? "bg-neutro-bg text-neutro"
        }`}
      >
        {nombre}
      </span>
      {mostrar && (
        <span className="rounded-pill bg-ambar-bg px-2 py-0.5 text-[10px] font-bold text-ambar">
          Venció
        </span>
      )}
    </span>
  );
}
