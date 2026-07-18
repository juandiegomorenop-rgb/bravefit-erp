import type { GarantiaDetalle } from "@/lib/data/ops";
import type { DocumentosOp } from "@/lib/data/ops-server";
import { formatFecha } from "@/lib/formato";
import { RECOGIDA_LABEL } from "../GarantiasClient";

/**
 * Formato Imprimible de GARANTÍA — distinto al de la O.P.: aquí no hay
 * lista de productos ni precios; hay falla, trabajo a realizar, recogida
 * y la referencia a la O.P. original con sus documentos (la garantía no
 * tiene cotización propia: hereda la trazabilidad del pedido que la originó).
 */
export function GarantiaImprimible({
  det,
  docs,
}: {
  det: GarantiaDetalle;
  docs: DocumentosOp;
}) {
  const g = det.garantia;
  const refCot = docs.cotizacion ? docs.cotizacion.numero : "N/A";
  const refFra = docs.factura
    ? (docs.factura.numero ?? "en proceso")
    : docs.sinFactura
      ? "N/A"
      : "—";

  return (
    <div className="mx-auto mt-6 w-full max-w-[760px] rounded-card border border-borde bg-white p-6 text-[12px] text-carbon print:m-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <style>{`@media print { @page { size: A4 portrait; margin: 10mm; } .no-print { display:none !important; } }`}</style>

      {/* Encabezado */}
      <div className="flex items-start justify-between border-b-2 border-carbon pb-3">
        <div>
          <div className="text-[18px] font-black tracking-tight">ORDEN DE GARANTÍA</div>
          <div className="text-[11px] text-neutro">
            Grupo Bravefit SAS · NIT 901.919.917-2 · Documento interno
          </div>
        </div>
        <div className="text-right">
          <div className="text-[16px] font-bold text-semaforo-rojo">{g.numero}</div>
          <div className="text-[11px] text-neutro">
            Abierta el {formatFecha(new Date(g.abierta_en))}
          </div>
        </div>
      </div>

      {/* Banner ambulancia */}
      <div className="mt-3 rounded-input bg-semaforo-rojo px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[1px] text-white">
        🚨 Garantía · Prioridad ambulancia · Va de primeras en cada etapa
      </div>

      {/* 3 tarjetas */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-input border border-semaforo-rojo/40 bg-rojo-bg px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-[.6px] text-neutro">
            Etapa actual
          </div>
          <div className="text-[15px] font-bold">{det.etapa.nombre}</div>
          <div className="text-[11px] text-neutro">
            {g.cerrada_en ? `Cerrada en ${det.dias} días` : `${det.dias} día${det.dias === 1 ? "" : "s"} abierta`}
          </div>
        </div>
        <div className="rounded-input border border-borde bg-sutil px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-[.6px] text-neutro">
            Recogida
          </div>
          <div className="text-[15px] font-bold">{RECOGIDA_LABEL[g.recogida]}</div>
        </div>
        <div className="rounded-input border border-borde bg-sutil px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-[.6px] text-neutro">
            Referencia
          </div>
          <div className="text-[13px] font-bold">O.P. {det.op_numero}</div>
          <div className="text-[10.5px] text-neutro">
            COT: {refCot} · FRA: {refFra}
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div className="mt-3 rounded-input border border-borde px-3 py-2">
        <div className="text-[10px] font-bold uppercase tracking-[.6px] text-neutro">
          Cliente
        </div>
        <b>{det.cliente.nombre}</b>
        <div className="text-[11px] text-neutro">
          {det.cliente.telefono ? `Tel: ${det.cliente.telefono}` : ""}
          {det.ciudad ? ` · ${det.ciudad.nombre}` : ""}
          {det.vendedor ? ` · Vendedor: ${det.vendedor.nombre}` : ""}
        </div>
      </div>

      {/* Producto afectado */}
      <div className="mt-4 mb-2 border-b border-carbon pb-1 text-[12px] font-bold uppercase tracking-[.6px]">
        Producto afectado
      </div>
      <div className="flex gap-3 rounded-card border border-borde p-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-input border border-borde bg-sutil">
          {det.producto?.imagen_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={det.producto.imagen_url}
              alt={det.producto.nombre}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-[10px] text-neutro">sin foto</span>
          )}
        </div>
        <div>
          <b className="text-[13px]">{det.producto?.nombre ?? "Por identificar"}</b>
          {det.producto && (
            <div className="text-[11px] text-neutro">{det.producto.sku}</div>
          )}
        </div>
      </div>

      {/* Falla y trabajo */}
      <div className="mt-4 mb-2 border-b border-carbon pb-1 text-[12px] font-bold uppercase tracking-[.6px]">
        Falla reportada
      </div>
      <p className="text-[14px] font-bold">{g.problema}</p>

      <div className="mt-4 mb-2 border-b border-carbon pb-1 text-[12px] font-bold uppercase tracking-[.6px]">
        Trabajo a realizar (reparación / cambio / mejora)
      </div>
      {g.detalle ? (
        <p className="text-[13px] leading-relaxed">{g.detalle}</p>
      ) : (
        <p className="text-[12px] italic text-neutro">
          Por definir tras diagnóstico — registrar aquí el trabajo acordado.
        </p>
      )}

      <div className="mt-6 border-t border-borde pt-2 text-[10px] text-neutro">
        Documento interno generado por el ERP Bravefit · Los consumos de material
        de la reparación se registran en el kardex colgados de esta garantía.
      </div>
    </div>
  );
}
