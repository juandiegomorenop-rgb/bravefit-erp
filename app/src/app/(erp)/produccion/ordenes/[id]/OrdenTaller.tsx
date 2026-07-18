import type { ComponenteBom } from "@/lib/data/ops-server";
import type { OpDetalle } from "@/lib/data/ops";
import { formatFecha } from "@/lib/formato";
import { parseFechaLocal } from "@/lib/ops-logic";

/**
 * Vista IMPRIMIBLE de la O.P. con el formato del taller (espejo del template
 * del planner). Documento interno: encabezado + banner + 3 tarjetas logísticas
 * + fabricación por equipo con despiece de platinas + totales consolidados.
 *
 * Se ve en pantalla como una "hoja" y al imprimir ocupa toda la página en
 * horizontal. El despiece muestra las platinas/impresión 3D del BOM; la
 * tornillería/tubería se sumará cuando se cargue ese BOM.
 */
export function OrdenTaller({
  detalle,
  bom,
}: {
  detalle: OpDetalle;
  bom: Map<string, ComponenteBom[]>;
}) {
  const { op, cliente, ciudad, items } = detalle;

  const totalUnidades = items.reduce((s, i) => s + i.cantidad, 0);
  const hoy = new Date();
  const vence = op.fecha_entrega_pactada
    ? parseFechaLocal(op.fecha_entrega_pactada)
    : null;
  const dias = vence
    ? Math.round((vence.getTime() - hoy.getTime()) / 86_400_000)
    : null;

  // Totales consolidados de platinas (BOM × cantidad de cada ítem)
  const totales = new Map<string, { nombre: string; cantidad: number; categoria: string }>();
  for (const it of items) {
    for (const c of bom.get(it.producto_id) ?? []) {
      const clave = c.material_nombre ?? c.descripcion;
      const prev = totales.get(clave) ?? { nombre: clave, cantidad: 0, categoria: c.categoria };
      prev.cantidad += c.cantidad * it.cantidad;
      totales.set(clave, prev);
    }
  }
  const totalesArr = [...totales.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );

  const racks = items.filter((i) => i.producto.es_rack);
  const otros = items.filter((i) => !i.producto.es_rack);

  return (
    <div className="taller mx-auto mt-6 w-full max-w-[1000px] rounded-card border border-borde bg-white p-6 text-[12px] text-carbon print:m-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } .no-print { display:none !important; } }`}</style>

      {/* Encabezado */}
      <div className="flex items-start justify-between border-b-2 border-carbon pb-3">
        <div>
          <div className="text-[18px] font-black tracking-tight">ORDEN DE PEDIDO</div>
          <div className="text-[11px] text-neutro">
            Grupo Bravefit SAS · NIT 901.919.917-2 · Documento interno
          </div>
        </div>
        <div className="text-right">
          <div className="text-[16px] font-bold text-dorado-oscuro">{op.numero}</div>
          <div className="text-[11px] text-neutro">
            {formatFecha(new Date(op.creado_en))}
          </div>
        </div>
      </div>

      {/* Banner interno */}
      <div className="mt-3 rounded-input bg-carbon px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[1px] text-white">
        Uso interno · No entregar al cliente
      </div>

      {/* 3 tarjetas logísticas */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Card tono="dorado" label="Fecha de entrega">
          <div className="text-[15px] font-bold">
            {vence ? formatFecha(vence) : "Sin fecha"}
          </div>
          <div className="text-[11px] text-neutro">
            {dias === null
              ? ""
              : dias < 0
                ? `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}`
                : `Faltan ${dias} día${dias === 1 ? "" : "s"}`}
          </div>
        </Card>
        <Card tono={op.requiere_instalacion ? "dorado" : "gris"} label="Requiere instalación">
          <div className="text-[15px] font-bold">
            {op.requiere_instalacion ? "SÍ" : "NO"}
          </div>
          <div className="text-[11px] text-neutro">
            {op.requiere_instalacion ? "Coordinar técnico" : "Solo despacho"}
          </div>
        </Card>
        <Card tono="aviso" label="¿Debe saldo?">
          <div className="text-[15px] font-bold">VERIFICAR</div>
          <div className="text-[11px] text-neutro">Confirmar pago antes de despachar</div>
        </Card>
      </div>

      {/* Proyecto + cliente */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Bloque label="Proyecto">
          <b>{op.numero}</b>
          <div className="text-[11px] text-neutro">
            {totalUnidades} equipo{totalUnidades === 1 ? "" : "s"} ·{" "}
            {items.length} producto{items.length === 1 ? "" : "s"} distinto
            {items.length === 1 ? "" : "s"}
          </div>
        </Bloque>
        <Bloque label="Cliente">
          <b>{cliente.nombre}</b>
          <div className="text-[11px] text-neutro">
            {cliente.tipo === "empresa" ? "NIT" : "CC"}: {cliente.nit_cedula ?? "—"}
            {cliente.telefono ? ` · Tel: ${cliente.telefono}` : ""}
          </div>
          <div className="text-[11px] text-neutro">
            {op.direccion_entrega ?? "—"}
            {ciudad ? ` · ${ciudad.nombre}` : ""}
          </div>
        </Bloque>
      </div>

      {/* Fabricación por equipo */}
      <SectionHeader>Fabricación por equipo</SectionHeader>
      <div className="flex flex-col gap-3">
        {racks.map((it) => (
          <Ficha key={it.id} it={it} comps={bom.get(it.producto_id) ?? []} grande />
        ))}
        {otros.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {otros.map((it) => (
              <Ficha key={it.id} it={it} comps={bom.get(it.producto_id) ?? []} />
            ))}
          </div>
        )}
      </div>

      {/* Totales consolidados */}
      {totalesArr.length > 0 && (
        <>
          <SectionHeader>
            Totales consolidados de platinas{" "}
            <span className="font-normal text-neutro">
              · para sacar de inventario / solicitar compras
            </span>
          </SectionHeader>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="border-b border-borde text-left text-[10.5px] uppercase tracking-[.4px] text-neutro">
                <th className="py-1.5 font-semibold">Platina</th>
                <th className="py-1.5 text-right font-semibold">Cantidad total</th>
              </tr>
            </thead>
            <tbody>
              {totalesArr.map((t, i) => (
                <tr key={t.nombre} className={i % 2 ? "bg-sutil" : ""}>
                  <td className="py-1.5">{t.nombre}</td>
                  <td className="py-1.5 text-right font-bold">{t.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10.5px] text-neutro">
            Nota: el despiece muestra platinas e impresión 3D. La tornillería,
            tubería y demás insumos se sumarán cuando se cargue ese BOM.
          </p>
        </>
      )}

      {op.notas && (
        <div className="mt-3 rounded-input border border-borde bg-sutil px-3 py-2 text-[11px]">
          <b>Observaciones del pedido: </b>
          {op.notas}
        </div>
      )}
    </div>
  );
}

function Card({
  tono,
  label,
  children,
}: {
  tono: "dorado" | "gris" | "aviso";
  label: string;
  children: React.ReactNode;
}) {
  const borde =
    tono === "dorado"
      ? "border-dorado bg-dorado-suave"
      : tono === "aviso"
        ? "border-aviso-borde bg-aviso"
        : "border-borde bg-sutil";
  return (
    <div className={`rounded-input border px-3 py-2 ${borde}`}>
      <div className="text-[10px] font-bold uppercase tracking-[.6px] text-neutro">
        {label}
      </div>
      {children}
    </div>
  );
}

function Bloque({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-input border border-borde px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[.6px] text-neutro">
        {label}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-2 border-b border-carbon pb-1 text-[12px] font-bold uppercase tracking-[.6px]">
      {children}
    </div>
  );
}

function Ficha({
  it,
  comps,
  grande = false,
}: {
  it: OpDetalle["items"][number];
  comps: ComponenteBom[];
  grande?: boolean;
}) {
  const p = it.producto;
  const dims = [
    p.ancho_cm ? `Largo ${p.ancho_cm} cm` : null,
    p.profundidad_cm ? `Fondo ${p.profundidad_cm} cm` : null,
    p.alto_cm ? `Alto ${p.alto_cm} cm` : null,
  ].filter(Boolean);
  return (
    <div className="flex gap-3 rounded-card border border-borde p-3">
      <div
        className={`grid shrink-0 place-items-center overflow-hidden rounded-input border border-borde bg-sutil ${
          grande ? "h-24 w-24" : "h-16 w-16"
        }`}
      >
        {p.imagen_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] text-neutro">sin foto</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <b className="text-[13px]">{p.nombre}</b>
          <span className="rounded-pill bg-carbon px-2 py-0.5 text-[10px] font-bold text-white">
            {it.cantidad} und
          </span>
        </div>
        <div className="text-[11px] text-neutro">
          {p.sku}
          {it.color ? ` · ${it.color}` : ""}
          {dims.length ? ` · ${dims.join(" · ")}` : ""}
        </div>

        {comps.length > 0 ? (
          <table className="mt-2 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#eee] text-left text-[10px] uppercase text-neutro">
                <th className="py-1 font-semibold">Platina</th>
                <th className="py-1 text-right font-semibold">×1</th>
                <th className="py-1 text-right font-semibold">Total ({it.cantidad})</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.descripcion} className="border-b border-[#f6f5f2] last:border-b-0">
                  <td className="py-1">{c.material_nombre ?? c.descripcion}</td>
                  <td className="py-1 text-right text-neutro">{c.cantidad}</td>
                  <td className="py-1 text-right font-bold">{c.cantidad * it.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mt-2 text-[10.5px] italic text-neutro">
            Sin BOM de platinas cargado para este producto.
          </div>
        )}
      </div>
    </div>
  );
}
