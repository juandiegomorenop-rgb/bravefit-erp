# Backlog de revisión — hallazgos pendientes de verificar

## Resueltos 2026-07-04 (tercera tanda — revisión adversarial de los triggers)
16 hallazgos confirmados por el segundo workflow, corregidos:
- [x] Deadlocks del kardex: trigger a nivel STATEMENT con orden canónico por existencia_id.
- [x] Promedio ponderado: saldo previo a costo 0 ya no diluye (costo entrante = nuevo promedio); 'ajuste' con costo fija costo inicial.
- [x] fn_validar_entrega_op: cubre INSERT, etapas terminales (Instalado), limpia fecha al retroceder, lock de op_items contra carreras con reversas.
- [x] fn_descontar_bom(op_id): descuento de BOM atómico e idempotente EN LA BD; mp_descontada_en solo se estampa por esa vía (candado GUC) y nunca se limpia.
- [x] fn_aplicar_despacho: rechaza despachos sobre OP anulada y reversas sobre OP entregada; orden de locks OP→ítem.
- [x] cantidad_entregada blindada por trigger (solo cambia vía op_despachos).
- [x] RLS: existencias nacen en cero; usuario_id = auth.uid() en kardex/despachos/pagos; pagos solo fuente='manual' para usuarios; despachos_del para quien aprueba producción.
- [x] fn_validar_recepcion security definer (el RLS del invocador la bypaseaba con NULL).
- [x] Storage: migración 0003 con buckets privados (hojas-vida, cv-aspirantes, adjuntos-op) y políticas espejo del RLS.
- [x] movimientos_inventario.garantia_id: kardex de garantías trazable (sustenta costo_resolucion).
- [x] v_op_saldo: total vs pagado por OP para "¿debe saldo?" antes de despachar.

## Decisiones de diseño (deliberadas, no bugs)
- **Colores libres en ítems/BOM**: cotizacion_items.color y op_items.color son texto
  libre A PROPÓSITO — el modelo ATO/MTO cobra recargo justamente por colores NO
  estándar, así que un FK a `colores` los bloquearía. `colores` es la fuente del
  dropdown de estándar en la UI; "no estándar" = no pertenece a la tabla.
- **DECISIÓN PARA JUAN — bloqueo por saldo**: ¿la BD debe IMPEDIR marcar
  Entregada una OP con saldo pendiente (v_op_saldo.pagado < total), o basta
  con advertencia prominente en la UI y que un Admin pueda autorizar
  excepciones? Recomendación: advertencia + confirmación explícita de Admin
  (bloqueo duro genera fricción cuando un pago llegó pero no se ha registrado).
- **Descuento de BOM en garantías**: las garantías reparan piezas puntuales, no
  refabrican el producto completo → los consumos se registran como movimientos
  manuales colgados de garantia_id (no hay fn_descontar_bom para garantías).

La revisión adversarial multiagente (2026-07-04) confirmó 16 hallazgos que **ya
fueron corregidos** en `0001_esquema.sql` / `0002_rls.sql` (ver commit). Estos
otros quedaron **sin verificar** porque los agentes verificadores chocaron con
el límite de sesión. Re-verificar y resolver antes de salir a producción:

## Resueltos 2026-07-04 (segunda tanda)
- [x] **Salarios/hoja de vida**: movidos a `empleados_confidencial` con RLS
      propio (solo rrhh.ver o el propio empleado). Separación física, no de API.
- [x] **fn_auditar** con `set search_path = public`.
- [x] **Tabla `pagos`** (anticipo/saldo/abono, fuente manual/siigo/shopify):
      logística consulta "¿debe saldo?" antes de despachar.
- [x] **ordenes_pedido.segmento B2B/B2C** agregado.
- [x] **Periodos con check de formato** (`^\d{4}-\d{2}$`, ciclos `^\d{4}-[12]$`).
- [x] **integracion_eventos**: unique PARCIAL sobre clave_externa (el de tabla
      no deduplicaba entre NULLs); el worker debe exigir clave en shopify/siigo.
- [x] **campana_metricas.ingresos** → ROAS calculable en consulta.
- [x] **Tabla `colores`** parametrizable + seed con paleta del planner.

## Pendientes que requieren verificación o decisión
- [ ] **Ops1/2 ven clientes** (por produccion.ver): intencional — necesitan
      nombre/ciudad en OPs. Confirmar con Juan si también deben ver teléfono/email.
- [ ] **Variantes de producto** no modeladas como entidad (solo overrides de
      dimensiones + color por ítem, modelo del planner). Decidir si se necesita
      `producto_variantes` con mapeo a variantes Shopify ANTES de migrar el
      catálogo Excel (~100 productos + variantes).
- [ ] **Borrado lógico**: convención transversal = el cliente SIEMPRE filtra
      `activo=true`; documentar en ARQUITECTURA y encapsular en el data layer.

## Dashboards (mockup Claude Design)
- [ ] Widget **alianzas** (dashboard Mercadeo del mockup) sin tabla que lo alimente.
- [ ] **Posición de caja** (dashboard Finanzas del mockup) sin fuente de datos —
      el PyG es manual; definir si caja también se carga manual.
- [ ] **Datos de Junta ene–abr 2026** referenciados en el mockup: pedir el Excel
      a Juan para sembrar `pyg_mensual` / `nivel_servicio_mensual`.

## Proceso
- [ ] La matriz roles×módulos vive en seed.sql — generar vista legible en
      Configuración (UI) para que Juan la pueda auditar sin leer SQL.
- [ ] Ajustar `secuencias.siguiente` de 'cotizacion' al último BFP-#### real del
      Planner antes de producción (marcado en seed.sql).
- [ ] Verificar festivos 2026–2027 contra calendario oficial.
