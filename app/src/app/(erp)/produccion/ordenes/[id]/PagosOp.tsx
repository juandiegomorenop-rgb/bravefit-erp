"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCOP, formatFechaCorta } from "@/lib/formato";
import { parseFechaLocal } from "@/lib/ops-logic";
import { registrarPagoOp } from "../actions";

/** Espejo del tipo PagoOp de ops-server (server-only, no importable aquí). */
interface Pago {
  id: string;
  concepto: "anticipo" | "saldo" | "abono" | "total";
  monto: number;
  medio: string | null;
  recibido_en: string;
  nota: string | null;
}

const CONCEPTO_LABEL: Record<Pago["concepto"], string> = {
  anticipo: "Anticipo",
  saldo: "Saldo",
  abono: "Abono",
  total: "Pago total",
};

/**
 * Pagos de la O.P. — SOLO Admins (la página lo renderiza según permisos
 * y la RLS de `pagos` lo exige de todos modos). Regla de Juan: sin
 * saldo en cero la BD bloquea marcar Entregado; aquí se registra el
 * pago para destrabar la entrega sin salir del ERP.
 */
export function PagosOp({
  opId,
  total,
  pagos,
}: {
  opId: string;
  total: number;
  pagos: Pago[];
}) {
  const router = useRouter();
  const pagado = pagos.reduce((a, p) => a + p.monto, 0);
  const saldo = Math.max(0, total - pagado);

  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState<Pago["concepto"]>(
    pagado === 0 ? "anticipo" : "saldo",
  );
  const [medio, setMedio] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Escribe un monto válido mayor a 0.");
      return;
    }
    if (
      !window.confirm(
        `¿Registrar ${CONCEPTO_LABEL[concepto].toLowerCase()} de ${formatCOP(valor)} a esta O.P.?`,
      )
    )
      return;
    setError(null);
    setOcupado(true);
    const r = await registrarPagoOp(opId, {
      monto: valor,
      concepto,
      medio: medio.trim() || null,
      nota: nota.trim() || null,
    });
    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAbierto(false);
    setMonto("");
    setMedio("");
    setNota("");
    router.refresh();
  }

  const inputCls =
    "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

  return (
    <div className="rounded-card border border-borde bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold">Pagos</h2>
        <span
          className={`rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${
            saldo === 0
              ? "bg-verde-bg text-verde"
              : "bg-rojo-bg text-rojo"
          }`}
        >
          {saldo === 0 ? "✓ Saldo en cero" : `Debe ${formatCOP(saldo)}`}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[8px] bg-sutil px-2 py-2">
          <p className="text-[10.5px] font-bold text-neutro">TOTAL O.P.</p>
          <p className="text-[13.5px] font-extrabold">{formatCOP(total)}</p>
        </div>
        <div className="rounded-[8px] bg-sutil px-2 py-2">
          <p className="text-[10.5px] font-bold text-neutro">PAGADO</p>
          <p className="text-[13.5px] font-extrabold text-verde">
            {formatCOP(pagado)}
          </p>
        </div>
        <div className="rounded-[8px] bg-sutil px-2 py-2">
          <p className="text-[10.5px] font-bold text-neutro">SALDO</p>
          <p
            className={`text-[13.5px] font-extrabold ${saldo > 0 ? "text-rojo" : "text-verde"}`}
          >
            {formatCOP(saldo)}
          </p>
        </div>
      </div>

      {pagos.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {pagos.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-2 rounded-[8px] border border-borde bg-sutil px-3 py-2 text-[12.5px]"
            >
              <b>{formatCOP(p.monto)}</b>
              <span className="rounded-pill bg-neutro-bg px-2 py-0.5 text-[10.5px] font-bold text-neutro">
                {CONCEPTO_LABEL[p.concepto]}
              </span>
              {p.medio && <span className="text-neutro">{p.medio}</span>}
              <span className="ml-auto text-[11.5px] text-neutro">
                {formatFechaCorta(parseFechaLocal(p.recibido_en))}
              </span>
              {p.nota && (
                <span className="w-full text-[11px] text-neutro">{p.nota}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-2 text-[12.5px] font-semibold text-rojo">{error}</p>
      )}

      {abierto ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              autoFocus
              type="number"
              min={0}
              placeholder="Monto COP *"
              className={`${inputCls} w-[140px]`}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            <select
              aria-label="Concepto del pago"
              className={inputCls}
              value={concepto}
              onChange={(e) => setConcepto(e.target.value as Pago["concepto"])}
            >
              <option value="anticipo">Anticipo</option>
              <option value="saldo">Saldo</option>
              <option value="abono">Abono</option>
              <option value="total">Pago total</option>
            </select>
            <input
              placeholder="Medio (transferencia…)"
              className={`${inputCls} min-w-[140px] flex-1`}
              value={medio}
              onChange={(e) => setMedio(e.target.value)}
            />
          </div>
          <input
            placeholder="Nota (opcional)"
            className={inputCls}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void guardar()}
              className="rounded-pill bg-carbon px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-40"
            >
              {ocupado ? "Registrando…" : "Registrar pago"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setError(null);
              }}
              className="rounded-pill px-3 py-2 text-[12.5px] font-semibold text-neutro hover:bg-neutro-bg"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-3 w-full rounded-pill border border-borde bg-card px-4 py-2 text-[12.5px] font-semibold hover:border-dorado"
        >
          ＋ Registrar pago
        </button>
      )}
    </div>
  );
}
