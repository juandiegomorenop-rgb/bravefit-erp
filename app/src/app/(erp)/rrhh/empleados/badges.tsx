/**
 * Badges compartidos de RRHH: área (planta/administración) y distintivo
 * TÉCNICO en dorado — es_tecnico es la llave de los permisos de Ops
 * (Ops1 ve vacaciones de técnicos, Ops2 solo las suyas).
 */

export function BadgeTecnico({ grande = false }: { grande?: boolean }) {
  return (
    <span
      title="Técnico de planta: visible para los permisos de Ops"
      className={`rounded-pill border border-dorado/50 bg-dorado-suave font-extrabold uppercase tracking-wider text-dorado-oscuro ${
        grande ? "px-3 py-1 text-[11px]" : "px-2 py-0.5 text-[9.5px]"
      }`}
    >
      Técnico
    </span>
  );
}

export function BadgeArea({ area }: { area: string | null }) {
  if (!area) return <span className="text-neutro">—</span>;
  const planta = area === "planta";
  return (
    <span
      className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold capitalize ${
        planta ? "bg-azul-bg text-azul" : "bg-neutro-bg text-neutro"
      }`}
    >
      {area}
    </span>
  );
}
