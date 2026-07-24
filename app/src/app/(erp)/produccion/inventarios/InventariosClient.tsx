"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fabricarSubensamble, registrarConsumoEspecial } from "./actions";
import {
  aplicarFiltrosInventario,
  estadoBuffer,
  UNIDAD_LABEL,
  type CompraMensual,
  type ExistenciaMP,
  type ExistenciaPT,
  type FiltrosInventarioMP,
} from "@/lib/data/inventario";
import { formatCOP } from "@/lib/formato";
import type { TipoMaterial } from "@/lib/types/db";
import { TendenciaCompras } from "./TendenciaCompras";
import { BadgeEstadoBuffer, BarraBuffer, formatCantidad } from "./ui";

interface Props {
  filasMP: ExistenciaMP[];
  filasPT: ExistenciaPT[];
  filasSE: ExistenciaPT[];
  compras: CompraMensual[];
  tipos: TipoMaterial[];
  filtrosIniciales: FiltrosInventarioMP;
}

/**
 * Juegos estructura + cojín: la estructura (subensamble) espera su
 * cojín (MP tapizada del proveedor) para volverse producto terminado.
 * Juan: "a veces hay más rollos que estructuras o viceversa… para eso
 * es este ERP: para pedir por juegos".
 */
const JUEGOS: { nombre: string; skuEstructura: string; prefijoCojin: string }[] = [
  { nombre: "Rack Pad", skuEstructura: "SE-EST-RACKPAD", prefijoCojin: "COJ005" },
  { nombre: "Rollos de asiento", skuEstructura: "SE-EST-ROLLOAS", prefijoCojin: "COJ003" },
  { nombre: "Banco reclinable", skuEstructura: "SE-EST-BANCOREC", prefijoCojin: "COJ004" },
];

/**
 * Recetas de las piezas ESPECIALES más comunes (columnas, uniones, barras
 * de medida no estándar). Julián elige el tipo + la medida + la cantidad y
 * el sistema calcula las platinas fijas y el tubo (= medida × cantidad),
 * en vez de que las tenga que seleccionar una por una.
 *
 * Los `fijos` (platinas, tapa) son por UNIDAD y se multiplican por la
 * cantidad. El tubo se calcula aparte: metros = medida × cantidad, del
 * bucket que corresponda. Consumibles (nivelador, chazos) NO van, igual
 * que en las recetas de subensamble.
 *
 * Los códigos coinciden con el primer token del nombre del material
 * ("P005 · …", "TUB70L · …"), que sobrevive a renombres.
 */
type TuboReceta = "70-por-medida" | "70-largo" | "redondo";
const RECETAS_ESPECIALES: {
  clave: string;
  label: string;
  fijos: { codigo: string; cant: number }[];
  tubo: TuboReceta;
}[] = [
  {
    clave: "union",
    label: "Unión perforada especial",
    fijos: [{ codigo: "P005", cant: 2 }],
    tubo: "70-por-medida", // ≥2.2m sale del bucket largo, si no del retazo
  },
  {
    clave: "col-niv",
    label: "Columna niveladora especial",
    fijos: [
      { codigo: "P014", cant: 1 },
      { codigo: "i3D001", cant: 1 },
    ],
    tubo: "70-largo", // una columna siempre sale de un tramo largo
  },
  {
    clave: "col-base",
    label: "Columna base especial",
    fijos: [
      { codigo: "P001", cant: 1 },
      { codigo: "i3D001", cant: 1 },
    ],
    tubo: "70-largo",
  },
  {
    clave: "barra",
    label: "Barra sencilla especial",
    fijos: [{ codigo: "P002", cant: 2 }],
    tubo: "redondo", // tubería redonda Ø33
  },
];

/** Inventarios (una sola bodega): KPIs + MP + subensambles + PT + tendencia. */
export function InventariosClient({
  filasMP,
  filasPT,
  filasSE,
  compras,
  tipos,
  filtrosIniciales,
}: Props) {
  const [filtros, setFiltros] = useState(filtrosIniciales);

  const filtradas = useMemo(
    () => aplicarFiltrosInventario(filasMP, filtros),
    [filasMP, filtros],
  );

  const kpis = useMemo(() => {
    const bajoBuffer = filasMP.filter(
      (f) =>
        estadoBuffer(f.existencia.cantidad_disponible, f.material) === "reponer",
    ).length;
    const valorTotal = filasMP.reduce(
      (acc, f) =>
        acc + f.existencia.cantidad_disponible * f.material.costo_promedio,
      0,
    );
    return { referencias: filasMP.length, bajoBuffer, valorTotal };
  }, [filasMP]);

  function actualizar(nuevos: FiltrosInventarioMP) {
    setFiltros(nuevos);
    const p = new URLSearchParams();
    if (nuevos.tipo_material_id) p.set("tipo", String(nuevos.tipo_material_id));
    if (nuevos.texto) p.set("q", nuevos.texto);
    if (nuevos.solo_bajo_buffer) p.set("bajo", "1");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="mb-4">
        <p className="text-[12.5px] text-neutro">Producción /</p>
        <h1 className="text-[26px] font-extrabold tracking-tight">
          Inventarios
        </h1>
        <p className="mt-0.5 text-[13px] text-neutro">
          Una sola bodega · buffers de reposición por consumo (Simple
          Solutions). Clic en un material para ver su kardex.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Referencias de materia prima
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">
            {kpis.referencias}
          </p>
        </div>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Bajo buffer mínimo
          </p>
          <p
            className={`mt-1 text-[24px] font-extrabold tracking-tight ${
              kpis.bajoBuffer > 0 ? "text-semaforo-rojo" : "text-verde"
            }`}
          >
            {kpis.bajoBuffer}
          </p>
        </div>
        <div className="rounded-card border border-borde bg-card px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
            Valor inventario MP
          </p>
          <p className="mt-1 text-[24px] font-extrabold tracking-tight">
            {formatCOP(kpis.valorTotal)}
          </p>
          <p className="text-[11px] text-neutro">
            Σ disponible × costo promedio
          </p>
        </div>
      </div>

      {/* Filtros MP */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          defaultValue={filtros.texto}
          onChange={(e) => actualizar({ ...filtros, texto: e.target.value })}
          placeholder="Buscar material…"
          className="w-full max-w-[300px] rounded-input border border-borde bg-card px-3.5 py-2 text-[13px] outline-none focus:border-dorado"
        />
        <select
          aria-label="Filtrar por tipo de material"
          value={filtros.tipo_material_id ?? ""}
          onChange={(e) =>
            actualizar({
              ...filtros,
              tipo_material_id: Number(e.target.value) || undefined,
            })
          }
          className="rounded-input border border-borde bg-card px-3 py-2 text-[13px] outline-none focus:border-dorado"
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={filtros.solo_bajo_buffer ?? false}
            onChange={(e) =>
              actualizar({ ...filtros, solo_bajo_buffer: e.target.checked })
            }
            className="h-4 w-4 accent-[#be9a2e]"
          />
          Solo bajo buffer
        </label>
        <span className="ml-auto text-[12.5px] text-neutro">
          <b className="text-carbon">{filtradas.length}</b>{" "}
          {filtradas.length === 1 ? "referencia" : "referencias"}
        </span>
      </div>

      <ConsumoEspecial materiales={filasMP} />

      {/* Tabla materia prima */}
      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[960px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde bg-sutil text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-2.5 font-semibold">Material</th>
              <th className="px-3 py-2.5 font-semibold">Tipo</th>
              <th className="px-3 py-2.5 font-semibold">Und</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Disponible
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Reservada
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Costo prom.
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Buffer min–max
              </th>
              <th className="w-[150px] px-3 py-2.5 font-semibold">Nivel</th>
              <th className="px-4 py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map(({ existencia, material, tipo }) => {
              const estado = estadoBuffer(
                existencia.cantidad_disponible,
                material,
              );
              return (
                <tr
                  key={existencia.id}
                  className="border-b border-[#f6f5f2] last:border-b-0 hover:bg-sutil"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/produccion/inventarios/${material.id}`}
                      className="font-semibold hover:text-dorado-oscuro hover:underline"
                    >
                      {material.nombre}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-neutro">{tipo.nombre}</td>
                  <td className="px-3 py-2.5 text-neutro">
                    {UNIDAD_LABEL[material.unidad_id] ?? "—"}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-bold ${
                      estado === "reponer" ? "text-semaforo-rojo" : ""
                    }`}
                  >
                    {formatCantidad(existencia.cantidad_disponible)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-neutro">
                    {formatCantidad(existencia.cantidad_reservada)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatCOP(material.costo_promedio)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-neutro">
                    {formatCantidad(material.buffer_min)}–
                    {formatCantidad(material.buffer_max)}
                  </td>
                  <td className="px-3 py-2.5">
                    <BarraBuffer
                      disponible={existencia.cantidad_disponible}
                      material={material}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <BadgeEstadoBuffer
                      estado={estado}
                      sugerirHref={`/produccion/compras?sugerir=${material.id}&cantidad=${Math.max(
                        1,
                        Math.ceil(
                          material.buffer_max - existencia.cantidad_disponible,
                        ),
                      )}`}
                    />
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-[13px] text-neutro"
                >
                  No hay materiales con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tendencia de compras */}
      <div className="mt-6">
        <TendenciaCompras
          compras={compras}
          materiales={filasMP.map((f) => ({
            id: f.material.id,
            nombre: f.material.nombre,
          }))}
        />
      </div>

      {/* Subensambles */}
      <h2 className="mt-8 text-[16px] font-extrabold tracking-tight">
        Subensambles
      </h2>
      <p className="mb-3 mt-0.5 text-[12.5px] text-neutro">
        Piezas fabricadas en casa (columnas, uniones perforadas, barras,
        estructuras) que se consumen dentro de otros productos. Las
        estructuras esperan su cojín para volverse producto terminado.
      </p>

      {/* Juegos estructura + cojín */}
      {(() => {
        const seBySku = new Map(filasSE.map((f) => [f.producto.sku, f]));
        const mpByPrefijo = (pref: string) =>
          filasMP.find((f) => f.material.nombre.startsWith(pref));
        const juegos = JUEGOS.map((j) => {
          const est = seBySku.get(j.skuEstructura)?.existencia.cantidad_disponible ?? 0;
          const coj = mpByPrefijo(j.prefijoCojin)?.existencia.cantidad_disponible ?? 0;
          return { ...j, est, coj, completos: Math.min(est, coj) };
        }).filter((j) => j.est > 0 || j.coj > 0);
        if (juegos.length === 0) return null;
        return (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {juegos.map((j) => (
              <div
                key={j.skuEstructura}
                className="rounded-card border border-borde bg-card px-5 py-4"
              >
                <p className="text-[12.5px] font-semibold text-neutro">
                  Juego · {j.nombre}
                </p>
                <p className="mt-1 text-[20px] font-extrabold tracking-tight">
                  {j.completos}{" "}
                  <span className="text-[12px] font-semibold text-neutro">
                    completos
                  </span>
                </p>
                <p className="mt-0.5 text-[12px] text-neutro">
                  {j.est} estructura{j.est === 1 ? "" : "s"} · {j.coj} cojín
                  {j.coj === 1 ? "" : "es"}
                </p>
                {j.est !== j.coj && (
                  <p className="mt-1.5 rounded-pill bg-dorado-suave px-2.5 py-0.5 text-[11px] font-bold text-dorado-oscuro">
                    {j.est > j.coj
                      ? `Faltan ${j.est - j.coj} cojines para completar`
                      : `Sobran ${j.coj - j.est} cojines sin estructura`}
                  </p>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde bg-sutil text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-2.5 font-semibold">Subensamble</th>
              <th className="px-3 py-2.5 font-semibold">SKU</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Disponible
              </th>
              <th className="px-4 py-2.5 text-right font-semibold">Fabricar</th>
            </tr>
          </thead>
          <tbody>
            {filasSE.map(({ existencia, producto }) => (
              <FilaSubensamble
                key={existencia.id}
                producto_id={producto.id}
                nombre={producto.nombre}
                sku={producto.sku}
                disponible={existencia.cantidad_disponible}
              />
            ))}
            {filasSE.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[13px] text-neutro"
                >
                  Sin subensambles en bodega.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Producto terminado */}
      <h2 className="mt-8 text-[16px] font-extrabold tracking-tight">
        Producto terminado
      </h2>
      <p className="mb-3 mt-0.5 text-[12.5px] text-neutro">
        Stock de productos listos en bodega (MTS y comercializados).
      </p>
      <div className="thead-flotante overflow-x-auto rounded-card border border-borde bg-card">
        <table className="w-full min-w-[520px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-borde bg-sutil text-left text-[11.5px] uppercase tracking-wider text-neutro">
              <th className="px-4 py-2.5 font-semibold">Producto</th>
              <th className="px-3 py-2.5 font-semibold">SKU</th>
              <th className="px-3 py-2.5 text-right font-semibold">
                Disponible
              </th>
              <th className="px-4 py-2.5 text-right font-semibold">
                Reservada
              </th>
            </tr>
          </thead>
          <tbody>
            {filasPT.map(({ existencia, producto }) => (
              <tr
                key={existencia.id}
                className="border-b border-[#f6f5f2] last:border-b-0 hover:bg-sutil"
              >
                <td className="px-4 py-2.5 font-semibold">{producto.nombre}</td>
                <td className="px-3 py-2.5 text-neutro">{producto.sku}</td>
                <td className="px-3 py-2.5 text-right font-bold">
                  {formatCantidad(existencia.cantidad_disponible)}
                </td>
                <td className="px-4 py-2.5 text-right text-neutro">
                  {formatCantidad(existencia.cantidad_reservada)}
                </td>
              </tr>
            ))}
            {filasPT.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[13px] text-neutro"
                >
                  Sin producto terminado en bodega.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Fila de subensamble con declaración de fabricación.
 *
 * Es la pieza que le faltaba al ERP: hasta hoy no había forma de SUMAR
 * algo fabricado, solo de descontarlo. Un clic de Julián dispara los dos
 * movimientos en una sola transacción — sube el subensamble al estante y
 * baja su receta — porque la regla que acordamos con Juan es que todo lo
 * fabricado pasa por el estante, aunque salga para un pedido el mismo día.
 *
 * La columna "Reservada" se quitó a propósito: `cantidad_reservada` no la
 * mantiene ningún proceso (siempre muestra 0) y hacía creer que el ERP
 * sabe qué material está apartado. No lo sabe.
 */
function FilaSubensamble({
  producto_id,
  nombre,
  sku,
  disponible,
}: {
  producto_id: string;
  nombre: string;
  sku: string;
  disponible: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState("1");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    setGuardando(true);
    const r = await fabricarSubensamble(producto_id, Number(cantidad), nota);
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAbierto(false);
    setCantidad("1");
    setNota("");
    router.refresh();
  }

  return (
    <>
      <tr className="border-b border-[#f6f5f2] last:border-b-0 hover:bg-sutil">
        <td className="px-4 py-2.5 font-semibold">{nombre}</td>
        <td className="px-3 py-2.5 text-neutro">{sku}</td>
        <td className="px-3 py-2.5 text-right font-bold">
          {formatCantidad(disponible)}
        </td>
        <td className="px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="rounded-pill border border-borde px-3 py-1 text-[12px] font-semibold hover:bg-sutil"
          >
            {abierto ? "Cancelar" : "＋ Fabriqué"}
          </button>
        </td>
      </tr>
      {abierto && (
        <tr className="border-b border-[#f6f5f2] bg-sutil">
          <td colSpan={4} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
              <label className="flex items-center gap-1.5">
                Fabriqué
                <input
                  type="number"
                  min={1}
                  step="any"
                  className="w-[90px] rounded-[8px] border border-borde bg-card px-2 py-1"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </label>
              <input
                placeholder="Nota (ej: para la OP de Jamer)"
                className="min-w-[220px] flex-1 rounded-[8px] border border-borde bg-card px-2 py-1"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <button
                type="button"
                disabled={guardando || !(Number(cantidad) > 0)}
                onClick={() => void guardar()}
                className="rounded-pill bg-carbon px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {guardando ? "Registrando…" : "Registrar"}
              </button>
            </div>
            <p className="mt-2 text-[11.5px] text-neutro">
              Sube {nombre} al estante y descuenta su receta. Si no alcanza el
              material, no se registra nada.
            </p>
            {error && (
              <p className="mt-2 text-[12px] font-semibold text-rojo">{error}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Consumo especial de materiales — piezas fuera de receta (uniones de
 * medida rara), mermas y material dañado. Es el hogar honesto de lo que
 * gasta material sin ser una receta estándar: sin esto, fabricar una
 * unión especial descontaría platinas y tubo del mundo físico pero no
 * del ERP, y el saldo quedaría inflado. Se descuenta como salida de
 * producción, así que cuenta en el consumo del mes y en el indicador de
 * perforado (una unión especial también se perfora).
 */
function ConsumoEspecial({ materiales }: { materiales: ExistenciaMP[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<{ material_id: string; cantidad: string }[]>(
    [{ material_id: "", cantidad: "" }],
  );
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<string | null>(null);
  const [medida, setMedida] = useState("");
  const [cantPreset, setCantPreset] = useState("1");
  // Clave de idempotencia: estable entre reintentos del MISMO consumo (si el
  // insert se comitea pero se pierde la respuesta, reintentar no duplica).
  // Se genera al primer envío y se limpia al cerrar → cada consumo nuevo trae
  // una clave nueva. No se genera en render para no romper la hidratación.
  const [opId, setOpId] = useState("");

  const opciones = useMemo(
    () =>
      [...materiales]
        .map((m) => ({
          id: m.material.id,
          nombre: m.material.nombre,
          disponible: m.existencia.cantidad_disponible,
          unidad: UNIDAD_LABEL[m.material.unidad_id] ?? "und",
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [materiales],
  );

  // Busca un material por el primer token del nombre ("P005 · …" → "P005").
  // Sin distinguir mayúsculas: un recase (i3D001 → I3D001) no debe romper el match.
  const porCodigo = (codigo: string) =>
    opciones.find(
      (o) => o.nombre.split(" ")[0].toUpperCase() === codigo.toUpperCase(),
    );

  /**
   * Aplica una receta especial: convierte (tipo + medida + cantidad) en las
   * filas de materiales, listas para que Julián las revise y confirme. Si
   * falta algún material en el catálogo, avisa en vez de descontar de menos.
   */
  function aplicarReceta(clave: string) {
    setError(null);
    const receta = RECETAS_ESPECIALES.find((r) => r.clave === clave);
    if (!receta) return;
    const m = Number(medida);
    const n = Number(cantPreset);
    if (!(m > 0) || !(n > 0)) {
      setError("Indica la medida (m) y la cantidad para aplicar la receta.");
      return;
    }

    const nuevas: { material_id: string; cantidad: string }[] = [];
    const faltan: string[] = [];

    for (const f of receta.fijos) {
      const mat = porCodigo(f.codigo);
      if (!mat) faltan.push(f.codigo);
      else nuevas.push({ material_id: mat.id, cantidad: String(f.cant * n) });
    }

    // Tubo: metros = medida × cantidad, del bucket que corresponda.
    const codigoTubo =
      receta.tubo === "redondo"
        ? "TUBR33"
        : receta.tubo === "70-largo" || m >= 2.2
          ? "TUB70L"
          : "TUB70R";
    const tubo = porCodigo(codigoTubo);
    if (!tubo) faltan.push(codigoTubo);
    else
      nuevas.push({
        material_id: tubo.id,
        cantidad: String(Number((m * n).toFixed(3))),
      });

    // Si falta cualquier material de la receta, NO se carga NADA: cargar una
    // receta incompleta y dejarla registrable descontaría de menos en silencio.
    if (faltan.length) {
      setError(
        `No están en el catálogo: ${faltan.join(", ")}. Créalos primero o arma la lista a mano — no se cargó la receta para no descontar de menos.`,
      );
      return;
    }
    setFilas(nuevas);
    setMotivo(`${receta.label} ${m}m ×${n}`);
  }

  function cerrar() {
    setAbierto(false);
    setFilas([{ material_id: "", cantidad: "" }]);
    setMotivo("");
    setPreset(null);
    setMedida("");
    setCantPreset("1");
    setError(null);
    setOpId(""); // consumo cerrado → el próximo trae clave nueva
  }

  async function guardar() {
    setError(null);
    const items = filas
      .filter((f) => f.material_id && Number(f.cantidad) > 0)
      .map((f) => ({ material_id: f.material_id, cantidad: Number(f.cantidad) }));
    if (!items.length) {
      setError("Agrega al menos un material con cantidad.");
      return;
    }
    // Misma clave en cada reintento de este consumo; se limpia al cerrar.
    let id = opId;
    if (!id) {
      id = crypto.randomUUID();
      setOpId(id);
    }
    setGuardando(true);
    const r = await registrarConsumoEspecial(items, motivo, id);
    setGuardando(false);
    if (!r.ok) {
      setError(r.error); // se conserva opId: reintentar no duplica
      return;
    }
    cerrar();
    router.refresh();
  }

  if (!abierto) {
    return (
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-pill border border-borde px-4 py-2 text-[12.5px] font-semibold hover:bg-sutil"
        >
          ＋ Registrar consumo especial / merma
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-card border border-borde bg-card p-4">
      <p className="text-[13px] font-bold">Consumo especial de material</p>
      <p className="mt-0.5 text-[11.5px] text-neutro">
        Para piezas fuera de receta (uniones de medida rara), mermas o material
        dañado. Descuenta del inventario y queda en el consumo del mes.
      </p>

      {/* Atajos: piezas especiales comunes con receta parametrizada */}
      <div className="mt-3 rounded-[10px] border border-borde bg-sutil p-3">
        <p className="text-[11.5px] font-semibold uppercase tracking-wider text-neutro">
          Pieza especial común — pon la medida y el sistema calcula platinas y
          tubo
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RECETAS_ESPECIALES.map((r) => (
            <button
              key={r.clave}
              type="button"
              onClick={() => {
                setPreset(r.clave);
                setError(null);
              }}
              className={`rounded-pill border px-3 py-1 text-[12px] font-semibold ${
                preset === r.clave
                  ? "border-carbon bg-carbon text-white"
                  : "border-borde hover:bg-card"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {preset && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
            <label className="flex items-center gap-1.5">
              medida
              <input
                type="number"
                min={0}
                step="any"
                placeholder="m"
                className="w-[90px] rounded-[8px] border border-borde bg-card px-2 py-1.5"
                value={medida}
                onChange={(e) => setMedida(e.target.value)}
              />
              m
            </label>
            <label className="flex items-center gap-1.5">
              cantidad
              <input
                type="number"
                min={1}
                step="1"
                className="w-[80px] rounded-[8px] border border-borde bg-card px-2 py-1.5"
                value={cantPreset}
                onChange={(e) => setCantPreset(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => aplicarReceta(preset)}
              className="rounded-pill bg-dorado px-4 py-1.5 text-[12.5px] font-semibold text-carbon hover:opacity-90"
            >
              Aplicar receta
            </button>
            <span className="text-[11.5px] text-neutro">
              Llena la lista de abajo; puedes ajustarla antes de registrar.
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {filas.map((f, idx) => {
          const sel = opciones.find((o) => o.id === f.material_id);
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <select
                aria-label="Material"
                className="min-w-[240px] flex-1 rounded-[8px] border border-borde bg-card px-2 py-1.5"
                value={f.material_id}
                onChange={(e) =>
                  setFilas((fs) =>
                    fs.map((x, i) =>
                      i === idx ? { ...x, material_id: e.target.value } : x,
                    ),
                  )
                }
              >
                <option value="">Elegir material…</option>
                {opciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} (hay {formatCantidad(o.disponible)} {o.unidad})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="cantidad"
                className="w-[110px] rounded-[8px] border border-borde bg-card px-2 py-1.5"
                value={f.cantidad}
                onChange={(e) =>
                  setFilas((fs) =>
                    fs.map((x, i) =>
                      i === idx ? { ...x, cantidad: e.target.value } : x,
                    ),
                  )
                }
              />
              {sel && <span className="text-neutro">{sel.unidad}</span>}
              {filas.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setFilas((fs) => fs.filter((_, i) => i !== idx))
                  }
                  className="text-[12px] text-rojo hover:underline"
                >
                  quitar
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() =>
          setFilas((fs) => [...fs, { material_id: "", cantidad: "" }])
        }
        className="mt-2 text-[12px] font-semibold text-dorado hover:underline"
      >
        ＋ Otro material
      </button>

      <input
        placeholder="Motivo (ej: unión especial 0.6m para OP de Orlando)"
        className="mt-3 w-full rounded-[8px] border border-borde bg-card px-3 py-2 text-[12.5px]"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />

      {error && (
        <p className="mt-2 text-[12px] font-semibold text-rojo">{error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={guardando}
          onClick={() => void guardar()}
          className="rounded-pill bg-carbon px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {guardando ? "Registrando…" : "Registrar consumo"}
        </button>
        <button
          type="button"
          onClick={cerrar}
          className="rounded-pill border border-borde px-4 py-2 text-[12.5px] font-semibold hover:bg-sutil"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
