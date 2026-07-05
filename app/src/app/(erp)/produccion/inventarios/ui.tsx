import Link from "next/link";
import { estadoBuffer, type EstadoBuffer } from "@/lib/data/inventario";
import type { Material } from "@/lib/types/db";

/** Cantidades numeric(12,3) en es-CO: 1234.5 → "1.234,5". */
export function formatCantidad(n: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n);
}

const ESTADO_BADGE: Record<EstadoBuffer, { etiqueta: string; clase: string }> = {
  reponer: { etiqueta: "REPONER", clase: "bg-semaforo-rojo text-white" },
  ok: { etiqueta: "OK", clase: "bg-verde-bg text-verde" },
  exceso: { etiqueta: "EXCESO", clase: "bg-ambar-bg text-ambar" },
};

/**
 * Badge del estado vs buffers. En REPONER acompaña el link "Sugerir SC"
 * hacia el módulo de Compras.
 */
export function BadgeEstadoBuffer({
  estado,
  conSugerirSc = false,
}: {
  estado: EstadoBuffer;
  conSugerirSc?: boolean;
}) {
  const b = ESTADO_BADGE[estado];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block rounded-pill px-2 py-0.5 text-[10.5px] font-extrabold tracking-wider ${b.clase}`}
      >
        {b.etiqueta}
      </span>
      {conSugerirSc && estado === "reponer" && (
        <Link
          href="/produccion/compras"
          className="whitespace-nowrap text-[11.5px] font-semibold text-dorado-oscuro hover:underline"
        >
          Sugerir SC →
        </Link>
      )}
    </span>
  );
}

/**
 * Barra visual del nivel de stock contra los buffers min/max.
 * Escala 0 → buffer_max × 1,25; las marcas verticales son min y max.
 */
export function BarraBuffer({
  disponible,
  material,
}: {
  disponible: number;
  material: Material;
}) {
  const escala = material.buffer_max * 1.25 || 1;
  const pct = Math.min(100, (disponible / escala) * 100);
  const minPct = (material.buffer_min / escala) * 100;
  const maxPct = (material.buffer_max / escala) * 100;
  const estado = estadoBuffer(disponible, material);
  const color =
    estado === "reponer"
      ? "bg-semaforo-rojo"
      : estado === "exceso"
        ? "bg-ambar"
        : "bg-verde";

  return (
    <div
      className="relative h-2 w-full min-w-[110px] rounded-pill bg-neutro-bg"
      title={`Disponible ${formatCantidad(disponible)} · buffers ${formatCantidad(material.buffer_min)}–${formatCantidad(material.buffer_max)}`}
    >
      <div
        className={`h-full rounded-pill ${color}`}
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute -inset-y-0.5 w-px bg-carbon/35"
        style={{ left: `${minPct}%` }}
      />
      <div
        className="absolute -inset-y-0.5 w-px bg-carbon/35"
        style={{ left: `${maxPct}%` }}
      />
    </div>
  );
}
