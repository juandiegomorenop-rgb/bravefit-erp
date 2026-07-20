"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { subirFoto } from "../actions";

/**
 * Subir/reemplazar la foto del producto sin salir del ERP (antes las
 * imágenes vivían en el repo y exigían un deploy). Solo Admins: la
 * política del bucket `productos` exige permiso de Ventas.
 */
export function SubirFotoProducto({
  productoId,
  tieneFoto,
}: {
  productoId: string;
  tieneFoto: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSubiendo(true);
    const fd = new FormData();
    fd.append("foto", file);
    const r = await subirFoto(productoId, fd);
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void alElegir(e)}
      />
      <button
        type="button"
        disabled={subiendo}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-pill border border-borde bg-card px-4 py-2 text-[12.5px] font-semibold hover:border-dorado disabled:opacity-40"
      >
        {subiendo
          ? "Subiendo…"
          : tieneFoto
            ? "🖼 Cambiar foto"
            : "🖼 Subir foto"}
      </button>
      <p className="mt-1 text-center text-[11px] text-neutro">
        JPG, PNG o WEBP · máx. 5 MB
      </p>
      {error && (
        <p className="mt-1 text-[12px] font-semibold text-rojo">{error}</p>
      )}
    </div>
  );
}
