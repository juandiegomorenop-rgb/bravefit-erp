# BOM de Subensambles — BORRADOR

Recetas que Juan va dictando para la **Fase 2** del modelo de subensambles.
Cuando estén completas y confirmadas, se convierten en cargas SQL (BOM de dos niveles).

> **Nombre de la categoría: ✅ SUBENSAMBLES (elegido por Juan 22-jul).** El módulo de inventario se llama "Subensambles"; internamente el `existencias.tipo` llevará el código `'subensamble'`. Contraste de categorías: Materia Prima (comprado) → **Subensambles** (fabricado en casa, entra en productos) → Producto Terminado (se vende).

> Regla de clasificación: **¿está en el catálogo de ventas con precio?**
> Sí → PT · Pieza fabricada que entra en otros productos → **Semielaborado** · Insumo comprado → MP.

## Convenciones
- **Materiales que descuentan stock**: platinas (P0XX), tubo, tapas i3D, niveladores, chazos → líneas de BOM.
- **Mano de obra**: NO es material, es **costo** → **DECISIÓN: minutos × tarifa/hora** (tarifa global; al subir el salario se recalcula todo). Cada semielaborado lleva un campo "tiempo m.o. (min)".
- El **tubo PTS 70×70** se mide en **metros lineales** → alimenta el indicador de capacidad de planta.

## Nomenclatura de columnas (decisión de diseño 22-jul)
Nombrar la columna por sus ATRIBUTOS FÍSICOS, nunca por el rack donde suele ir.
Dos atributos INDEPENDIENTES: **altura** + **tipo de base** (niveladora / anclaje a piso).
- Display: `Columna 70×70 · <altura>m · <base niveladora | anclaje piso>`
- SKU: `SE-COL-<altura_mm>-<NIV|ANC>` (ej. `SE-COL-220-NIV`, `SE-COL-230-ANC`).
- El BOM del PRODUCTO trae la columna por defecto (plantilla); la **OP congela la columna real**.
- El tiquete de producción muestra el spec completo (altura+base), no el nombre del rack → evita errores.
- Estándar de uso (solo por defecto, overridible): 2.2m → PF5, PF10 v2.0 · 2.3m/2.7m → S15, P20.
- ✅ CONFIRMADO por Juan: base INDEPENDIENTE de la altura (un PF5 a 2.3m sigue niveladora, solo más alto).
- ✅ Display names confirmados: `Columna 70×70 · 2.2m · base niveladora`, `Columna 70×70 · 2.3m · anclaje piso`.

## Nuevas MP a crear (descubiertas en las recetas)
- **Tubo PTS 70×70** (unidad: metros) — driver de capacidad de planta.
- **Nivelador 1/2" (el espigo)** — unidad.
- **Chazos 1/2" (anclaje a piso)** — unidad. (Distintos de los "chazos pared 3/8" de los formatos de OP.)

---

## Productos terminados (nivel 0) — receta en partes

### Rack PF5 Fijo (SKU 1RaPF5f)
- 2 × Columna 2.2m niveladora *(semielaborado, por defecto)*
- **4** × Unión perforada 0.5m *(semielaborado)* — CORREGIDO: son 4, no 5 (coincide con formatos OP)
- 1 par × J-Locks
- 1 × Barra sencilla 1m *(o Barra tipo M si el cliente la pide)*
- Tornillería
- _(pendiente confirmar el resto)_

---

## Semielaborados (nivel 1) — receta en MP

### Columna 70×70 2.2m · base niveladora (SE-COL-220-NIV)
- 1 × Platina nivelador — **P014** ✅ existe
- 1 × Nivelador 1/2" (espigo) — ❌ crear MP
- 2.2 m × Tubo PTS 70×70 — ❌ crear MP (metros)
- 1 × Tapa columna 70×70 — **i3D001** ✅ existe
- Mano de obra (min × tarifa)

### Columna 70×70 2.3m · anclaje a piso (SE-COL-230-ANC)
- 1 × Platina base — **P001** ✅ existe
- 3 × Chazos 1/2" (anclaje a piso) — ❌ crear MP
- 2.3 m × Tubo PTS 70×70 — ❌ crear MP (metros)
- 1 × Tapa columna 70×70 — **i3D001** ✅ existe
- Mano de obra (min × tarifa)

### Columna 70×70 2.7m · anclaje a piso (SE-COL-270-ANC) — del conteo hay 6 en stock
- 1 × Platina base — **P001** ✅ existe
- 3 × Chazos 1/2" (anclaje a piso) — ❌ crear MP
- 2.7 m × Tubo PTS 70×70 — ❌ crear MP (metros)
- 1 × Tapa columna 70×70 — **i3D001** ✅ existe
- Mano de obra (min × tarifa)
- (Misma receta que la 2.3m anclaje, solo cambia el largo del tubo — confirmado Juan)

### Columna 70×70 2.0m · ??? (del conteo hay 2 en stock)
- _(pendiente)_

### Unión perforada 0.5m
- _(pendiente que Juan dicte la receta)_

---

## Roadmap por fases
- **Fase 1** — Categoría Subensambles + módulo de inventario + cargar el stock contado (conteo 21-jul). Solo stock, sin BOM todavía.
- **Fase 2** — BOM de dos niveles: receta de cada subensamble (→ MP) y reapuntar los BOM de productos a subensambles. Habilita capacidad de planta 100% real y descuento automático al producir.
- **Fase 3 (FUTURA) — Producto en Proceso (PP)**: Juan (22-jul) señaló que SIEMPRE hay PP en planta pero NO hay RRHH para contarlo. Solución acordada: el PP **se DERIVA**, no se cuenta — sale de las OPs abiertas moviéndose por el kanban de 12 etapas (consumo al iniciar producción + entrada al terminar; lo intermedio = PP). Prerrequisito: Fase 2. Arrancar GRUESO (PP ≈ valor de materiales de OPs abiertas) y afinar por etapa después. Sin conteo manual → viable con los recursos actuales.

## Preguntas abiertas
1. ✅ Mano de obra: minutos × tarifa/hora (DECIDIDO).
2. ⚠️ ¿Tipo de base independiente de la altura? (asumido SÍ).
3. Recetas pendientes: columnas 2.7m y 2.0m, unión perforada 0.5m, xbeans, barras, cojines.
4. Tiempo de m.o. (min) de cada semielaborado + tarifa/hora global.
5. Unidad de compra del tubo 70×70 (barras de 6m) vs consumo en metros — confirmar.
