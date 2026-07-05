"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarAjuste } from "../actions";

/**
 * Botón + formulario de ajuste manual (isla cliente).
 * Llama el SERVER action `registrarAjuste` (unión discriminada, sin
 * throw) y refresca los datos del server component al confirmar.
 */
export function RegistrarAjuste({
  existenciaId,
  unidad,
}: {
  existenciaId: string;
  unidad: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [signo, setSigno] = useState<1 | -1>(1);
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [costo, setCosto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cerrar() {
    setAbierto(false);
    setError(null);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cant = Number(cantidad);
    if (!Number.isFinite(cant) || cant <= 0) {
      setError("Ingresa una cantidad mayor que cero.");
      return;
    }
    if (!nota.trim()) {
      setError("La nota es obligatoria para dejar rastro del ajuste.");
      return;
    }
    let costoNum: number | undefined;
    if (costo.trim() !== "") {
      costoNum = Number(costo);
      if (!Number.isFinite(costoNum) || costoNum <= 0) {
        setError("El costo unitario, si se indica, debe ser mayor que cero.");
        return;
      }
    }

    startTransition(async () => {
      const r = await registrarAjuste(
        existenciaId,
        signo * cant,
        nota.trim(),
        costoNum,
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCantidad("");
      setNota("");
      setCosto("");
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        className="rounded-pill bg-carbon px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
      >
        {abierto ? "Cerrar" : "Registrar ajuste"}
      </button>

      {abierto && (
        <form
          onSubmit={enviar}
          className="absolute right-0 top-full z-10 mt-2 w-[320px] rounded-card border border-borde bg-card p-4 shadow-[0_8px_28px_rgba(0,0,0,.12)]"
        >
          <p className="text-[13px] font-bold">Ajuste de inventario</p>
          <p className="mt-0.5 text-[11.5px] text-neutro">
            El kardex es inmutable: el ajuste queda como movimiento nuevo y no
            puede dejar el saldo negativo.
          </p>

          <div className="mt-3 flex rounded-pill border border-borde bg-sutil p-0.5">
            <button
              type="button"
              onClick={() => setSigno(1)}
              className={`flex-1 rounded-pill px-3 py-1 text-[12px] font-semibold transition-colors ${
                signo === 1 ? "bg-verde text-white" : "text-neutro"
              }`}
            >
              + Entrada
            </button>
            <button
              type="button"
              onClick={() => setSigno(-1)}
              className={`flex-1 rounded-pill px-3 py-1 text-[12px] font-semibold transition-colors ${
                signo === -1 ? "bg-semaforo-rojo text-white" : "text-neutro"
              }`}
            >
              − Salida
            </button>
          </div>

          <label className="mt-3 block text-[12px] font-semibold">
            Cantidad {unidad && <span className="text-neutro">({unidad})</span>}
            <input
              type="number"
              min="0"
              step="any"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-input border border-borde bg-sutil px-3 py-2 text-[13px] font-normal outline-none focus:border-dorado"
            />
          </label>

          <label className="mt-2.5 block text-[12px] font-semibold">
            Nota <span className="text-semaforo-rojo">*</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Motivo del ajuste (conteo físico, merma…)"
              className="mt-1 w-full resize-y rounded-input border border-borde bg-sutil px-3 py-2 text-[13px] font-normal outline-none focus:border-dorado"
            />
          </label>

          <label className="mt-2.5 block text-[12px] font-semibold">
            Costo unitario COP{" "}
            <span className="font-normal text-neutro">
              (opcional — solo entradas actualizan el promedio)
            </span>
            <input
              type="number"
              min="0"
              step="any"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              placeholder="—"
              className="mt-1 w-full rounded-input border border-borde bg-sutil px-3 py-2 text-[13px] font-normal outline-none focus:border-dorado"
            />
          </label>

          {error && (
            <p className="mt-2.5 rounded-input bg-rojo-bg px-3 py-2 text-[12px] font-semibold text-rojo">
              {error}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold text-neutro hover:text-carbon"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendiente}
              className="rounded-pill bg-carbon px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pendiente ? "Guardando…" : "Registrar ajuste"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
