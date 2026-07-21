"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  fmtPct,
  formatCOP,
  type CacRoasCanal,
  type Canal,
  type ContenidoAgregado,
  type EmbudoLeads,
  type PautaCanal,
  type PruebaCreativa,
  type RangoFechas,
  type Segmento,
  type TipoFormato,
} from "@/lib/data/mercadeo";

interface Props {
  dias: number;
  rango: RangoFechas;
  canales: Canal[];
  categorias: string[];
  contenido: ContenidoAgregado[];
  pauta: PautaCanal[];
  embudo: EmbudoLeads;
  cacRoas: CacRoasCanal[];
  pruebas: PruebaCreativa[];
}

const FORMATO_LABEL: Record<TipoFormato, string> = {
  reel: "Reel",
  carrusel: "Carrusel",
  estatico: "Estático",
  story: "Story",
  video: "Video",
};

const numero = (n: number) => n.toLocaleString("es-CO");

export function MercadeoClient({
  dias,
  rango,
  canales,
  categorias,
  contenido,
  pauta,
  embudo,
  cacRoas,
  pruebas,
}: Props) {
  const router = useRouter();
  const [formato, setFormato] = useState<TipoFormato | "">("");
  const [categoria, setCategoria] = useState("");
  const [segmento, setSegmento] = useState<Segmento | "">("");

  // sub-filtros del contenido (client-side sobre el agregado del rango)
  const contenidoFiltrado = useMemo(() => {
    return contenido.filter((c) => {
      if (formato && c.tipo_formato !== formato) return false;
      if (categoria && c.categoria_producto !== categoria) return false;
      if (
        segmento &&
        c.segmento !== segmento &&
        c.segmento !== "ambos" &&
        segmento !== "ambos"
      )
        return false;
      return true;
    });
  }, [contenido, formato, categoria, segmento]);

  const top3 = useMemo(
    () =>
      [...contenidoFiltrado]
        .sort((a, b) => b.engagement_score - a.engagement_score)
        .slice(0, 3),
    [contenidoFiltrado],
  );

  function cambiarDias(d: number) {
    router.push(`/mercadeo?dias=${d}`);
  }

  const selCls =
    "rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-neutro">Mercadeo</p>
          <h1 className="text-[26px] font-extrabold tracking-tight">Marketing y pauta</h1>
          <p className="mt-0.5 text-[12.5px] text-neutro">
            Instagram orgánico + Meta Ads · el modelo ya soporta Google, TikTok y
            WhatsApp sin rediseño.
          </p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => cambiarDias(d)}
              className={`rounded-pill border px-4 py-2 text-[12.5px] font-bold ${
                dias === d
                  ? "border-carbon bg-carbon text-white"
                  : "border-borde bg-card text-neutro hover:border-dorado"
              }`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {/* Canales activos/planeados */}
      <div className="mb-5 flex flex-wrap gap-2">
        {canales.map((c) => (
          <span
            key={c.id}
            className={`rounded-pill px-3 py-1 text-[11.5px] font-bold ${
              c.estado === "activo"
                ? "bg-verde-bg text-verde"
                : "bg-neutro-bg text-neutro"
            }`}
          >
            {c.nombre}
            {c.estado !== "activo" && ` · ${c.estado}`}
          </span>
        ))}
      </div>

      {/* ===== TOP 3 POR ENGAGEMENT (widget estrella) ===== */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-extrabold tracking-tight">
            🏆 Top 3 publicaciones por engagement
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <select
              aria-label="Formato"
              value={formato}
              onChange={(e) => setFormato(e.target.value as TipoFormato | "")}
              className={selCls}
            >
              <option value="">Todo formato</option>
              {(Object.keys(FORMATO_LABEL) as TipoFormato[]).map((f) => (
                <option key={f} value={f}>
                  {FORMATO_LABEL[f]}
                </option>
              ))}
            </select>
            <select
              aria-label="Categoría"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className={selCls}
            >
              <option value="">Toda categoría</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              aria-label="Segmento"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value as Segmento | "")}
              className={selCls}
            >
              <option value="">B2B y B2C</option>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {top3.map((c, i) => (
            <div
              key={c.id}
              className="relative rounded-card border border-borde bg-card p-4"
            >
              <span className="absolute right-3 top-3 text-[22px] font-black text-dorado-claro">
                #{i + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="rounded-pill bg-azul-bg px-2 py-0.5 text-[10px] font-bold text-azul">
                  {FORMATO_LABEL[c.tipo_formato]}
                </span>
                {c.categoria_producto && (
                  <span className="rounded-pill bg-dorado-suave px-2 py-0.5 text-[10px] font-bold text-dorado-oscuro">
                    {c.categoria_producto}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[13.5px] font-bold leading-snug">{c.titulo}</p>
              <p className="mt-2 text-[11.5px] text-neutro">
                Engagement score
              </p>
              <p className="text-[24px] font-extrabold text-dorado-oscuro">
                {c.engagement_score.toFixed(3)}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
                <Mini n={c.likes} l="👍" />
                <Mini n={c.comentarios} l="💬" />
                <Mini n={c.compartidos} l="🔁" />
                <Mini n={c.guardados} l="🔖" />
              </div>
              <p className="mt-2 text-[11px] text-neutro">
                Alcance {numero(c.alcance)} · Interacción {fmtPct(c.tasa_interaccion)}
              </p>
            </div>
          ))}
          {top3.length === 0 && (
            <p className="col-span-3 rounded-card border border-borde bg-card px-4 py-8 text-center text-neutro">
              No hay contenido con estos filtros en el rango.
            </p>
          )}
        </div>
      </section>

      {/* ===== Rendimiento de contenido (tabla) ===== */}
      <section className="mb-6">
        <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">
          Rendimiento de contenido orgánico
        </h2>
        <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-borde text-left text-[11px] uppercase tracking-wider text-neutro">
                <th className="px-4 py-2.5 font-bold">Publicación</th>
                <th className="px-3 py-2.5 font-bold">Formato</th>
                <th className="px-3 py-2.5 text-right font-bold">Alcance</th>
                <th className="px-3 py-2.5 text-right font-bold">No seg.</th>
                <th className="px-3 py-2.5 text-right font-bold">Interacción</th>
                <th className="px-3 py-2.5 text-right font-bold">Clics WA</th>
                <th className="px-3 py-2.5 text-right font-bold">Eng. score</th>
              </tr>
            </thead>
            <tbody>
              {contenidoFiltrado.map((c) => (
                <tr key={c.id} className="border-b border-borde last:border-0 hover:bg-sutil">
                  <td className="max-w-[280px] px-4 py-2.5 font-semibold">{c.titulo}</td>
                  <td className="px-3 py-2.5 text-neutro">{FORMATO_LABEL[c.tipo_formato]}</td>
                  <td className="px-3 py-2.5 text-right">{numero(c.alcance)}</td>
                  <td className="px-3 py-2.5 text-right text-neutro">
                    {fmtPct(c.alcance > 0 ? c.alcance_no_seguidores / c.alcance : 0, 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right">{fmtPct(c.tasa_interaccion)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-verde">
                    {numero(c.clics_whatsapp)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold">
                    {c.engagement_score.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ===== Embudo Lead → Venta ===== */}
        <section>
          <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">
            Embudo Lead → Venta
          </h2>
          <div className="rounded-card border border-borde bg-card p-5">
            <Embudo embudo={embudo} />
            <div className="mt-3 flex items-center justify-between border-t border-borde pt-3 text-[13px]">
              <span className="text-neutro">
                Tasa de cierre:{" "}
                <b className="text-carbon">{fmtPct(embudo.tasa_cierre)}</b>
              </span>
              <span className="text-neutro">
                Valor ganado:{" "}
                <b className="text-verde">{formatCOP(embudo.valor_ganado)}</b>
              </span>
            </div>
          </div>
        </section>

        {/* ===== Pauta por canal ===== */}
        <section>
          <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">
            Rendimiento de pauta por canal
          </h2>
          <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
            <table className="w-full min-w-[420px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-borde text-left text-[11px] uppercase tracking-wider text-neutro">
                  <th className="px-4 py-2.5 font-bold">Canal</th>
                  <th className="px-3 py-2.5 text-right font-bold">Gasto</th>
                  <th className="px-3 py-2.5 text-right font-bold">Result.</th>
                  <th className="px-3 py-2.5 text-right font-bold">Costo/result.</th>
                  <th className="px-3 py-2.5 text-right font-bold">CTR</th>
                </tr>
              </thead>
              <tbody>
                {pauta.map((p) => (
                  <tr key={p.canal} className="border-b border-borde last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{p.canal}</td>
                    <td className="px-3 py-2.5 text-right">{formatCOP(p.gasto)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(p.resultados)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      {formatCOP(p.costo_por_resultado)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-neutro">{fmtPct(p.ctr, 2)}</td>
                  </tr>
                ))}
                {pauta.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-neutro">
                      Sin pauta en el rango.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ===== CAC y ROAS real por canal ===== */}
      <section className="mt-6">
        <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">
          CAC y ROAS real por canal{" "}
          <span className="text-[12px] font-normal text-neutro">
            (leads cerrados vinculados a ventas)
          </span>
        </h2>
        <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-borde text-left text-[11px] uppercase tracking-wider text-neutro">
                <th className="px-4 py-2.5 font-bold">Canal</th>
                <th className="px-3 py-2.5 text-right font-bold">Gasto</th>
                <th className="px-3 py-2.5 text-right font-bold">Leads</th>
                <th className="px-3 py-2.5 text-right font-bold">Cerrados</th>
                <th className="px-3 py-2.5 text-right font-bold">Ingresos</th>
                <th className="px-3 py-2.5 text-right font-bold">CAC</th>
                <th className="px-3 py-2.5 text-right font-bold">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {cacRoas.map((c) => (
                <tr key={c.canal} className="border-b border-borde last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{c.canal}</td>
                  <td className="px-3 py-2.5 text-right">{formatCOP(c.gasto)}</td>
                  <td className="px-3 py-2.5 text-right">{numero(c.leads)}</td>
                  <td className="px-3 py-2.5 text-right">{numero(c.cerrados)}</td>
                  <td className="px-3 py-2.5 text-right text-verde">{formatCOP(c.ingresos)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {c.cac !== null ? formatCOP(c.cac) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold">
                    {c.roas !== null ? (
                      <span className={c.roas >= 1 ? "text-verde" : "text-rojo"}>
                        {c.roas.toFixed(2)}×
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11px] text-neutro">
          CAC = gasto ÷ leads cerrados ganados · ROAS = ingresos atribuidos ÷ gasto.
          El orgánico (Instagram) no tiene gasto de pauta, por eso no calcula CAC.
        </p>
      </section>

      {/* ===== Bitácora de aprendizajes ===== */}
      <section className="mt-6">
        <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">
          Bitácora de aprendizajes creativos (A/B)
        </h2>
        <div className="space-y-2.5">
          {pruebas.map((p) => (
            <div key={p.id} className="rounded-card border border-borde bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-[13.5px]">{p.hipotesis}</b>
                {p.se_aplico ? (
                  <span className="rounded-pill bg-verde-bg px-2 py-0.5 text-[10.5px] font-bold text-verde">
                    ✓ Aplicado
                  </span>
                ) : (
                  <span className="rounded-pill bg-aviso px-2 py-0.5 text-[10.5px] font-bold text-aviso-texto ring-1 ring-aviso-borde">
                    En curso
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] text-neutro">
                Variantes: {p.variantes.join(" vs. ")}
              </p>
              {p.resultado && <p className="mt-1.5 text-[13px]">{p.resultado}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* WhatsApp — Fase 4 planeada */}
      <section className="mt-6">
        <div className="rounded-card border border-dashed border-borde bg-sutil p-5">
          <p className="text-[13px] font-bold">📱 Campañas masivas de WhatsApp — Fase 4</p>
          <p className="mt-1 text-[12.5px] text-neutro">
            El modelo de datos ya soporta envíos masivos, plantillas y monitoreo de
            calidad de cuenta (quality rating / tier). Se activa cuando formalicemos la
            WhatsApp Cloud API — monitoreando la calidad para evitar bloqueos.
          </p>
        </div>
      </section>
    </div>
  );
}

function Mini({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="text-[13px]">{l}</div>
      <div className="font-bold">{numero(n)}</div>
    </div>
  );
}

function Embudo({ embudo }: { embudo: EmbudoLeads }) {
  const etapas = [
    { label: "Nuevos", n: embudo.nuevo, color: "bg-neutro" },
    { label: "Cotizados", n: embudo.cotizado, color: "bg-azul" },
    { label: "Ganados", n: embudo.cerrado_ganado, color: "bg-verde" },
    { label: "Perdidos", n: embudo.cerrado_perdido, color: "bg-semaforo-rojo" },
  ];
  const max = Math.max(1, ...etapas.map((e) => e.n));
  return (
    <div className="space-y-2">
      {etapas.map((e) => (
        <div key={e.label} className="flex items-center gap-3">
          <span className="w-[74px] text-[12.5px] text-neutro">{e.label}</span>
          <div className="flex-1">
            <div
              className={`h-6 rounded-[6px] ${e.color}`}
              style={{ width: `${Math.max(4, (e.n / max) * 100)}%` }}
            />
          </div>
          <b className="w-8 text-right text-[13px]">{e.n}</b>
        </div>
      ))}
    </div>
  );
}
