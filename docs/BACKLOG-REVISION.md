# Backlog de revisión — hallazgos pendientes de verificar

La revisión adversarial multiagente (2026-07-04) confirmó 16 hallazgos que **ya
fueron corregidos** en `0001_esquema.sql` / `0002_rls.sql` (ver commit). Estos
otros quedaron **sin verificar** porque los agentes verificadores chocaron con
el límite de sesión. Re-verificar y resolver antes de salir a producción:

## Seguridad / RLS
- [ ] **Ops1/Ops2 pueden leer salario_base y hoja_vida_url de técnicos**: la
      política `empleados_sel` da la FILA completa; `campos_ocultos` solo se
      filtra en la API. Si el cliente consulta PostgREST directo, ve el salario.
      Opciones: vista `v_empleados_basico` (security_invoker + columnas seguras)
      para Ops, o política por columnas vía grant de columnas.
- [ ] **fn_auditar**: ya se le agregó `set search_path = public` (hecho).
- [ ] **Ops1/2 no pueden ver clientes** — revisar: `clientes_sel` exige
      ventas.ver O produccion.ver; Ops tienen produccion.ver → SÍ ven. Verificar
      que sea intencional (necesitan nombre/ciudad del cliente en OPs; probablemente OK).

## Modelo de datos
- [ ] **Variantes de producto** no modeladas como entidad (solo overrides de
      dimensiones + color por ítem). Decidir si el catálogo necesita tabla
      `producto_variantes` (Shopify las tiene) antes de la migración del catálogo.
- [ ] **No hay tabla de pagos/abonos**: condiciones PP 60/40 no tienen registro
      de anticipos recibidos. Siigo lleva la cartera — decidir si el ERP solo
      muestra (sync Siigo) o registra abonos propios.
- [ ] **ordenes_pedido sin segmento B2B/B2C** (cotizaciones sí lo tienen; OPs de
      Shopify serían B2C por defecto). Necesario para dashboard ventas por canal.
- [ ] **Periodos como text** (`pyg_mensual.periodo`, `nominas.periodo`,
      `nivel_servicio_mensual.periodo`, `evaluaciones.ciclo`): agregar
      `check (periodo ~ '^\d{4}-\d{2}$')` o tipo date normalizado al día 1.
- [ ] **integracion_eventos idempotencia**: `clave_externa` es nullable y el
      UNIQUE (sistema, tipo_evento, clave_externa) no aplica con NULL → eventos
      sin clave pueden duplicarse. Evaluar `not null` o unique parcial.
- [ ] **Borrado lógico incompleto**: varias entidades tienen `eliminado_en` pero
      las políticas/vistas no filtran `activo`. Definir convención transversal
      (el cliente SIEMPRE filtra `activo=true`; índices parciales ya lo asumen).
- [ ] **Colores**: `colores_disponibles text[]` sin catálogo parametrizable de
      colores estándar. Evaluar tabla `colores`.

## Dashboards (mockup Claude Design)
- [ ] **campana_metricas no guarda ingresos atribuidos** → ROAS incalculable.
      Agregar columna `ingresos numeric` o definir atribución (manual por ahora).
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
