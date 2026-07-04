# Backlog de revisión — hallazgos pendientes de verificar

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
