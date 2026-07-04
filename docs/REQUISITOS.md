# ERP Bravefit — Requisitos consolidados (v1, julio 2026)

Fuente de verdad del proyecto. Consolida: entrevista con Juan (dueño), handoff de Claude Design (`design/README.md`), documento del consultor Simple Solutions, y hallazgos del Bravefit Planner (`C:\Users\User\Projects\bravefit-planner\`).

## 1. Contexto

- **Empresa**: Grupo Bravefit — fabricante y comercializador de equipos de gimnasio (racks, rigs, bancos, accesorios). Medellín, Colombia; vende a todo el país. NIT 901.919.917-0.
- **Empresa única** (no multi-tenant). Moneda COP, formato es-CO (`$28.400.000`). Fechas en español.
- **Mantenimiento**: Juan + Claude. Priorizar simplicidad operativa, logging claro, diagnóstico fácil.
- **Online** con dominio propio (DNS en GoDaddy → subdominio sugerido `erp.bravefit.co`). Desktop-first 1440px, responsive tablet/móvil.

## 2. Usuarios y permisos (RBAC)

5 usuarios, auth correo + contraseña:

| Rol | Alcance |
|---|---|
| **Administrador** (×3) | Todo. Solo Admin ve Ventas/CRM/Cotizaciones/Mercadeo/PyG. |
| **Operaciones 1** (×1) | Producción y Logística completo. RRHH: sus vacaciones + vacaciones de técnicos de planta + evaluaciones de técnicos y las suyas. Cartelera. Dashboard: solo widgets de sus módulos. |
| **Operaciones 2** (×1) | Igual a Ops1 pero SIN info de técnicos en vacaciones (solo las suyas). SÍ ve evaluaciones de técnicos y las suyas. Cartelera. |

- Estructura: tablas `roles` + `permisos` (por módulo: ver/crear/editar/aprobar + `campos_ocultos` jsonb, ej. ocultar salarios/costos). Guard a nivel de **base de datos (RLS)**, API y UI.
- Roles parametrizables: agregar un rol nuevo = filas nuevas, no código nuevo.
- **Chat Claude embebido**: hereda permisos del rol del usuario logueado. Fase 1: consultas de solo lectura. Fase 2: acciones (crear cotización, agregar observación a una OP) desde el chat.
- Auditoría (`auditoria`: quién cambió qué, cambios jsonb) + borrado lógico en todas las entidades de negocio.

## 3. Productos y precios

- Catálogo Maestro ~100 productos + variantes (migrar desde Excel). 8 categorías 1:1 con Shopify: racks, rigs, accesorios, outdoor, hogar, fuerza, acondicionamiento, almacenamiento.
- **SKU dual**: `sku` Bravefit/Shopify (formato `BF-XX-NNN`) + `sku_siigo` (unificación: producto único con dos alias; las integraciones traducen). Referencia: `bravefit-planner/app/src/types/index.ts` y `catalogo/catalogo_template_v2.xlsx`.
- **Origen**: propio (PP, fabricado) vs comercializado (PC, reventa). Condiciones de pago: PP 60% anticipo + 40% antes de entrega; PC 100% anticipado.
- **Clasificación Simple Solutions**: MTS (alta rotación, color negro, stock permanente) / ATO (personaliza color en pintura, premium) / MTO (a medida, premium alto).
- **BOM (despiece)** por producto, en construcción por Bravefit. Estructura ya tipada en el planner: componente con categoría (columna, unión perforada, j_lock, barra_pull_up, tornillo, arandela, tuerca, wasa, chazo, otro), cantidad, longitud_cm, color, `color_sigue_rack`, `visible_cliente` (true → ficha técnica cliente; false → solo producción).
- **Dimensiones variables** (alto/fondo) con min/max/default y `precio_por_cm_extra`. El largo (ancho_cm) nunca es variable.
- **Precios**: lista única, precios CON IVA incluido (19%). Premium por personalización = **recargos parametrizables por atributo** (base + recargos visibles en cotización), no listas separadas.
- Unidades de medida: metros y unidades.
- Colores estándar: Negro, Rojo, Azul, Blanco, Gris, Verde militar.

## 4. Ventas

### Cotizaciones
- Numeración `BFP-NNNN` (continúa la serie del planner). Plantilla visual = la del planner (`bravefit-planner/docs/cotizacion-template/`).
- **Segmento B2B/B2C obligatorio al crear.**
- IVA 19% siempre, EXCEPTO ítems de transporte/envío (con opción de elegir IVA sí/no por ítem). Validez 15 días.
- **Flag `no_facturar`**: cliente pide no factura → NO va a Siigo, SÍ suma a ventas/dashboard/indicadores. Badge visible "⛔ NO FACTURA · suma a ventas".
- Descuento por pago 100% anticipado (0–50%, default 5%).
- Orígenes de creación: manual, chat Claude, planner.
- **Facturas**: el ERP NUNCA genera números de factura. Se crean vía API Siigo (plan Siigo Premium) y se guarda el número devuelto, vinculado a OP y cotización.

### CRM (kanban drag & drop)
- Etapas (parametrizables, seed): **En conversaciones → Elaborando Cotización y/o Render → Cotizado → Ganado / Perdido**.
- Ficha = oportunidad (cliente, cotización nullable, valor, vendedor, días en etapa).
- **Al Ganar → OP automática.**

### Shopify
- Pestañas: Nuevas sin entregar · Histórico (KPIs año + tabla) · Analítica estilo Shopify (Sesiones, Ventas totales, Pedidos, Tasa de conversión; línea actual vs periodo anterior punteado).
- Webhook pedido pagado → cola `integracion_eventos` → worker → OP automática + descuento inventario. Cliente se crea/machea por email.

### Análisis de ventas
Dimensiones por chips: cliente, vendedor, producto, ciudad, canal, **propio vs comercializado**, **B2B vs B2C**.

## 5. Producción y Logística

### Órdenes de Pedido (OP)
- Numeración desde cero: `OP-XXX`. Garantías: `GR-XXXX`.
- **Etapas (parametrizables, seed)**: En Cola → Corte → Soldadura → Perforación → Pintura → Ensamble → Empaque → Esperando Transportadora → En Reparto → Entregado → Pendiente instalación → Instalado.
- Vistas: **Lista / Kanban / Calendario** (calendario por fecha de entrega o de creación, con toggle).
- Orígenes (parametrizables): Shopify, WhatsApp, Planner, Cotización. Pedidos del Planner entran como WhatsApp por ahora.
- **Todos los orígenes generan OP automática al confirmar PAGO.** Comercializados también entran a En Cola (sub-estado visible "Esperando proveedor" si hay compra al proveedor) y saltan a Empaque al recibir mercancía.
- **Semáforo (calculado, nunca almacenado)** sobre `fecha_entrega_pactada`: sin color >3 semanas · amarillo 2–3 · rojo 1–2 · **negro = vencido**. Aplica en lista, kanban, calendario y dashboard.
- Cada vista muestra: instalación Sí/No y ciudad. **Producto principal** = el rack; si no hay, el de mayor precio; "+N" por los demás.
- **Entregas parciales**: registrar entregado vs pendiente por ítem; la OP solo pasa a Entregada con el 100% despachado.
- Detalle OP: stepper de etapas, ítems con totales, cliente/fechas/pago, historial de etapas (usuario + timestamp), botón Imprimir (formato taller pendiente de Juan).
- Al pasar de "En Cola" a "Corte" se descuenta materia prima según BOM (kardex).

### Inventario
- **Una sola bodega** (sin columna bodega). Tipos: terminado / materia_prima / en_proceso.
- **Kardex**: tabla `movimientos_inventario` (entrada compra, salida producción, ajuste, devolución; referencia a OP/recepción; usuario; timestamp). Costo promedio ponderado.
- **Buffers Simple Solutions** (reposición por consumo): verde <60% consumido, amarillo 60–85%, rojo >85% = comprar ya. Al caer bajo mínimo → sugerir solicitud de compra automáticamente.
- Gráficos de tendencia de consumo/compras por referencia según filtro.

### Solicitudes de compra
- Un renglón por **tipo de material** (tubería, platinería, cojinería, tornillería, plásticos de ingeniería, insumos — parametrizable), expandible a sus ítems.
- `valor_estimado` lo digita el comprador cuando los proveedores cotizan.
- Estados: Pendiente → En cotización → Comprado (habilita fecha de entrega) | Rechazada.
- **Recepción**: logística marca ítem por ítem (✓ completo / ⚠ faltante con nota y seguimiento hasta cierre).

### Garantías
- Campos: cliente, producto, falla/problema, # OP, # factura, # cotización, **vendedor** (contacto ante dudas), recogida programada vs cliente envía.
- **Mismo flujo de etapas que las OP** pero con distintivo grande "GARANTÍA" y **prioridad tipo ambulancia** (siempre arriba, visual inconfundible).
- KPIs: mes, año, % sobre entregas, tiempo medio de resolución. Maestro-detalle con clic.

### Entregas
- Vista sobre OPs con `fecha_entregada` (no tabla aparte). KPIs mes/año/récord/promedio, barras por mes (récord dorado), últimas entregas.

## 6. Mercadeo
- Campañas Meta/Google/TikTok: inversión, alcance, clics, leads; CPL y ROAS calculados en consulta. Métricas diarias.
- Encuestas: generadas desde el ERP (diseño pendiente de Juan), preguntas jsonb, respuesta ligada a cliente/OP (post-entrega).
- Redes sociales: visualizaciones, engagement, top posts.

## 7. Recursos Humanos
- **Empleados**: lista maestro-detalle; hoja de vida resumida (cédula, contrato, salario, EPS/ARL, fecha ingreso) + PDF adjunto.
- **Nómina: se queda en Siigo por ahora.** El esquema debe dejar la puerta abierta (tabla `nominas` con devengos/deducciones jsonb) para absorberla algún día. NO construir UI de liquidación en fase 1.
- **Vacaciones**: solicitud → aprueba un Admin. Calendario con fecha de regreso calculada con **días hábiles L–V + festivos de Colombia**. Mostrar: días pendientes por persona, cuándo cumple derecho, quién está de vacaciones y cuándo regresa. Regla: **máx. 2 personas de la misma área simultáneamente** (alertar conflicto).
- **Evaluaciones de desempeño**: por ciclo (ej. 2026-1), puntaje /5, criterios jsonb.
- **Reclutamiento**: vacantes con embudo Aplicaron → Entrevista → Finalistas → Contratado, CV adjunto.

## 8. Cartelera (módulo propio, nivel superior)
- Muro interno: **todos los roles pueden publicar**. Posts con `importante` (badge dorado) y `fijada`. Reacciones 👍. Sidebar de próximos eventos.

## 9. Dashboard (5 pestañas)
1. **Resumen**: KPIs (ventas mes, pedidos activos, vencidos en naranja #FD5C13, entregados/récord), barras 6 meses, ventas por ciudad, próximos a vencer con semáforo, redes.
2. **Comercial**: B2C vs B2B apilado por mes, racks/poleas vendidos, top productos.
3. **Finanzas**: tabla PyG (concepto × meses + % vs meta con chip verde/rojo), posición de caja, card de lectura rápida. **PyG NO se calcula**: gerencia lo carga manualmente (pantalla de captura o import Excel) → `pyg_mensual` + `conceptos_pyg` (% meta y dirección más/menos-es-mejor).
4. **Mercadeo**: pauta vs facturación con retorno (×), alianzas.
5. **Operación**: nivel de servicio mensual vs meta 85% (línea punteada dorada), cumplidos/incumplidos, observaciones del mes.
- Widgets visibles según rol. Datos de Junta ene–abr 2026 del mockup son reales (usar como seed de ejemplo).

## 10. Integraciones
- **Shopify**: webhooks (orders/paid) → `integracion_eventos` (cola con payload jsonb, estado, reintentos) → worker. Sync catálogo futuro (Shopify Admin API, metafields).
- **Siigo**: API plan Premium. Facturas salen del ERP hacia Siigo; guardar número devuelto. Sincronizar clientes/productos donde aplique. Nómina en Siigo.
- **WhatsApp**: SOLO Cloud API oficial de Meta (miedo justificado a baneos con librerías no oficiales). Fase posterior.
- **Claude**: chat embebido (Anthropic API), con herramientas de consulta a la BD respetando el rol del usuario.

## 11. Datos a migrar
- Catálogo: Excel ~100 productos + variantes (planner `catalogo_template_v2.xlsx` como base).
- Clientes: ~50/mes.
- OPs históricas: pocas, en papel — Juan subirá fotos.
- Histórico de ventas 2026 (Excel) para gráficas — PENDIENTE de que Juan lo envíe.
- Datos de Junta ene–abr 2026 (en el mockup) para PyG/dashboard.

## 12. Requisitos no funcionales
- **Seguridad**: RLS en todas las tablas; secretos solo en variables de entorno; validación server-side de todo input; rate limiting en endpoints públicos (webhooks); verificación HMAC de webhooks Shopify; sesiones seguras; HTTPS siempre; sin secretos en el repo.
- **Escalabilidad/parametrización**: etapas CRM, etapas producción, orígenes OP, estados, categorías, tipos de material y conceptos PyG son **tablas de catálogo**, no enums. Navegación data-driven. Nuevos módulos = tablas + permisos nuevos, sin refactor.
- **Mantenibilidad**: TypeScript estricto, código y esquema en español consistente con el dominio, migraciones versionadas, seed reproducible, logging estructurado.
- **Diseño**: tokens exactos en `design/README.md` (carbón #2B2B2B, dorado #BE9A2E, naranja #FD5C13 solo alertas, etc.). Alta fidelidad respecto al mockup.

## 13. Pendientes de Juan (no bloquean el desarrollo)
- Histórico de ventas 2026 (Excel).
- Fotos de OPs históricas en papel.
- Formato imprimible de OP (versión taller).
- Diseño de encuestas.
- SVG originales de logo/monograma.
- Credenciales: Supabase, Vercel, API Siigo, webhook Shopify (checklist en ARQUITECTURA.md).
