"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  AnaliticaShopify,
  FiltrosPedidos,
  MetricaComparada,
  PedidoWebCard,
  PeriodoClave,
} from "@/lib/data/shopify";
import { formatCOP, formatFechaCorta } from "@/lib/formato";
import type { PedidoWeb } from "@/lib/types/db";
import { generarOpDesdePedido } from "./actions";
import { GraficoVentas } from "./GraficoVentas";

interface Props {
  pedidos: PedidoWebCard[];
  analitica: AnaliticaShopify;
  periodo: PeriodoClave;
}

const PAGO_BADGE: Record<PedidoWeb["estado_pago"], string> = {
  pagado: "bg-verde-bg text-verde",
  pendiente: "bg-aviso text-aviso-texto ring-1 ring-aviso-borde",
  reembolsado: "bg-rojo-bg text-rojo",
};

const ENTREGA_LABEL: Record<PedidoWeb["estado_entrega"], string> = {
  sin_entregar: "Sin entregar",
  parcial: "Parcial",
  entregado: "Entregado",
};

const PERIODOS: { clave: PeriodoClave; nombre: string }[] = [
  { clave: "30d", nombre: "Últimos 30 días" },
  { clave: "90d", nombre: "Últimos 90 días" },
  { clave: "anio", nombre: "Últimos 12 meses" },
];

/**
 * Pedidos web (Shopify): analítica estilo Shopify arriba, luego las
 * ventas nuevas SIN entregar (con "Generar O.P." para las pagadas) y el
 * histórico. El pago dispara la OP automática; aquí se puede forzar.
 */
export function ShopifyClient({ pedidos, analitica, periodo }: Props) {
  const router = useRouter();
  const [filtros, setFiltros] = useState<FiltrosPedidos>({ solo_sin_entregar: true });
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; opId: string } | null>(null);

  function cambiarPeriodo(p: PeriodoClave) {
    router.push(`/ventas/shopify?periodo=${p}`);
  }

  const filtrados = useMemo(() => {
    const q = filtros.texto?.trim().toLowerCase();
    return pedidos.filter((c) => {
      if (filtros.estado_pago && c.pedido.estado_pago !== filtros.estado_pago) return false;
      if (
        filtros.solo_sin_entregar &&
        !(c.pedido.estado_pago === "pagado" && c.pedido.estado_entrega !== "entregado")
      )
        return false;
      if (q) {
        const blob = `${c.pedido.shopify_numero} ${c.cliente?.nombre ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [pedidos, filtros]);

  async function generar(pedidoId: string) {
    setError(null);
    setAviso(null);
    const r = await generarOpDesdePedido(pedidoId);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAviso({ texto: `Se generó la ${r.numero} en producción (En Cola).`, opId: r.op_id });
    router.refresh();
  }

  const sinEntregar = pedidos.filter(
    (c) => c.pedido.estado_pago === "pagado" && c.pedido.estado_entrega !== "entregado",
  ).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">Ventas /</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">Pedidos web · Shopify</h1>
        </div>
        <select
          aria-label="Periodo"
          value={periodo}
          onChange={(e) => cambiarPeriodo(e.target.value as PeriodoClave)}
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          {PERIODOS.map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Analítica estilo Shopify */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiShopify titulo="Sesiones" m={analitica.sesiones} tipo="entero" />
        <KpiShopify titulo="Ventas totales" m={analitica.ventas} tipo="cop" />
        <KpiShopify titulo="Pedidos" m={analitica.pedidos} tipo="entero" />
        <KpiShopify titulo="Tasa de conversión" m={analitica.conversion} tipo="pct" />
      </div>

      <div className="mb-6 rounded-card border border-borde bg-card p-5">
        <p className="mb-2 text-[13px] font-bold">Ventas totales a lo largo del tiempo</p>
        <GraficoVentas analitica={analitica} />
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-rojo/30 bg-rojo-bg px-4 py-3 text-[13px] font-semibold text-rojo">
          {error}
        </div>
      )}
      {aviso && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-card border border-verde/30 bg-verde-bg px-4 py-3 text-[13px] font-semibold text-verde">
          <span>{aviso.texto}</span>
          <Link
            href={`/produccion/ordenes/${aviso.opId}`}
            className="rounded-pill bg-verde px-3 py-1 text-[12px] font-bold text-white hover:opacity-90"
          >
            Ver la O.P. →
          </Link>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={filtros.texto ?? ""}
          onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
          placeholder="Buscar # de pedido o cliente…"
          className="w-full max-w-[280px] rounded-input border border-borde bg-card px-3.5 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setFiltros({ ...filtros, solo_sin_entregar: true, estado_pago: undefined })}
            className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
              filtros.solo_sin_entregar
                ? "border-carbon bg-carbon text-white"
                : "border-borde bg-card text-neutro hover:border-dorado"
            }`}
          >
            Nuevas sin entregar
            <span className="ml-1.5 rounded-pill bg-semaforo-rojo px-1.5 text-[10px] text-white">
              {sinEntregar}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFiltros({ ...filtros, solo_sin_entregar: false, estado_pago: undefined })}
            className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
              !filtros.solo_sin_entregar
                ? "border-carbon bg-carbon text-white"
                : "border-borde bg-card text-neutro hover:border-dorado"
            }`}
          >
            Histórico
          </button>
        </div>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtrados.length}</b> pedidos
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-3 font-bold">Pedido</th>
              <th className="px-4 py-3 font-bold">Cliente</th>
              <th className="px-4 py-3 font-bold">Productos</th>
              <th className="px-4 py-3 font-bold">Pago</th>
              <th className="px-4 py-3 font-bold">Entrega</th>
              <th className="px-4 py-3 text-right font-bold">Total</th>
              <th className="px-4 py-3 font-bold">O.P.</th>
              <th className="px-4 py-3 font-bold">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => {
              const primero = c.items[0];
              const otros = c.items.length - 1;
              return (
                <tr key={c.pedido.id} className="border-b border-borde last:border-0 hover:bg-sutil">
                  <td className="px-4 py-3 font-bold">{c.pedido.shopify_numero}</td>
                  <td className="px-4 py-3">{c.cliente?.nombre ?? "Invitado"}</td>
                  <td className="max-w-[240px] px-4 py-3 text-neutro">
                    {primero ? (
                      <>
                        {primero.producto.nombre}
                        {otros > 0 && <span className="text-[12px]"> +{otros} más</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold capitalize ${PAGO_BADGE[c.pedido.estado_pago]}`}
                    >
                      {c.pedido.estado_pago}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutro">
                    {ENTREGA_LABEL[c.pedido.estado_entrega]}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCOP(c.pedido.total)}
                  </td>
                  <td className="px-4 py-3">
                    {c.pedido.op_id ? (
                      <Link
                        href={`/produccion/ordenes/${c.pedido.op_id}`}
                        className="font-bold text-azul hover:underline"
                      >
                        Ver O.P.
                      </Link>
                    ) : c.convertible ? (
                      <button
                        type="button"
                        onClick={() => void generar(c.pedido.id)}
                        className="rounded-pill bg-carbon px-3 py-1 text-[11.5px] font-bold text-white hover:bg-black"
                      >
                        Generar O.P. →
                      </button>
                    ) : (
                      <span className="text-[12px] text-neutro">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutro">
                    {formatFechaCorta(new Date(c.pedido.recibido_en))}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutro">
                  No hay pedidos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiShopify({
  titulo,
  m,
  tipo,
}: {
  titulo: string;
  m: MetricaComparada;
  tipo: "entero" | "cop" | "pct";
}) {
  const valor =
    tipo === "cop"
      ? formatCOP(m.valor)
      : tipo === "pct"
        ? `${m.valor.toLocaleString("es-CO", { maximumFractionDigits: 2 })}%`
        : m.valor.toLocaleString("es-CO");
  const sube = (m.variacion ?? 0) >= 0;
  return (
    <div className="rounded-card border border-borde bg-card px-4 py-3">
      <p className="text-[11.5px] font-bold text-neutro">{titulo}</p>
      <p className="mt-0.5 text-[22px] font-extrabold">{valor}</p>
      {m.variacion === null ? (
        <p className="text-[11.5px] text-neutro">sin datos previos</p>
      ) : (
        <p className={`text-[11.5px] font-semibold ${sube ? "text-verde" : "text-rojo"}`}>
          {sube ? "▲" : "▼"} {Math.abs(m.variacion).toFixed(0)}%{" "}
          <span className="font-normal text-neutro">vs. periodo anterior</span>
        </p>
      )}
    </div>
  );
}
