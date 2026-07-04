# Handoff: ERP Bravefit

## Overview
ERP interno para **Bravefit** (fabricante y comercializador de equipos de gimnasio — racks, accesorios, bancos, jaulas — Medellín, Colombia; vende a todo el país). 5 usuarios internos con roles diferenciados. Módulos: Dashboard (con datos de Junta), Ventas (cotizaciones, CRM kanban, productos, catálogos, Shopify, análisis), Producción y Logística (inventarios, órdenes de pedido, compras, garantías, entregas), Mercadeo, Recursos Humanos y Cartelera (comunicación interna).

## About the Design Files
Los archivos de este paquete son **referencias de diseño creadas en HTML** (Design Components que se abren en navegador): prototipos que muestran el look y el comportamiento deseado, **no código de producción**. La tarea es **recrear estos diseños** en el stack que elijas para el proyecto (recomendado: React/Next.js + PostgreSQL + API REST o tRPC), usando patrones propios de ese stack. Si no existe codebase aún, elige el framework más apropiado y construye allí.

- `ERP Bravefit.dc.html` — mockup navegable completo (todas las pantallas). Requiere `support.js` junto a él para abrirse.
- `Esquema BD Bravefit.dc.html` — esquema de base de datos documentado (~36 tablas).
- `brand/` — logo y monograma extraídos del manual de marca 2024.

## Fidelity
**Alta fidelidad (hifi)**: colores, tipografía, espaciados, chips de estado y layouts son finales. Recrear con precisión visual. Los datos que se ven son de ejemplo (los de las pestañas de Junta del Dashboard son reales de ene–abr 2026).

## Requisitos técnicos globales
- **Responsive**: debe funcionar en PC, tablet y celular (el mockup es desktop-first 1440px; en móvil el menú horizontal colapsa a hamburguesa, las tablas hacen scroll horizontal o se convierten en cards).
- **Escalable/parametrizable**: etapas del CRM, etapas de producción, orígenes de O.P., estados, categorías y conceptos del PyG son **tablas de catálogo**, no enums fijos. Agregar módulos/submenús no debe requerir refactor: la navegación es data-driven (ver `NAV` en el logic class del mockup).
- **Roles y permisos**: el dueño (Juan) definirá los perfiles directamente contigo. La estructura ya está prevista: tablas `roles` + `permisos` (por módulo: ver/crear/editar/aprobar + `campos_ocultos` jsonb para ocultar p. ej. salarios o costos a ciertos roles). Implementar el guard a nivel de API y de UI (ítems de menú y columnas ocultas según permiso).
- **Moneda**: COP, formato es-CO (`$28.400.000`). Fechas en español.
- **Auditoría**: registrar quién cambió qué (tabla `auditoria`).
- **Borrado lógico** en todas las entidades de negocio.

## Reglas de negocio críticas (del dueño)
1. **PyG mensual NO se calcula** — gerencia lo extrae de contabilidad y lo carga en un cuadro resumen (pantalla de captura manual o import de Excel) → tabla `pyg_mensual` + catálogo `conceptos_pyg` (con % meta y dirección más/menos-es-mejor para el semáforo verde/rojo).
2. **Toda cotización pregunta B2B o B2C** al crearse (obligatorio). Cada producto está clasificado como **propio (fabricado)** o **comercializado** → el módulo Análisis de ventas reporta ventas por origen (propio vs comercializado) y por segmento (B2B vs B2C).
3. **Cotizaciones sin factura**: algunos clientes piden no facturar. Flag `no_facturar` en la cotización → esta será el último documento del negocio, **NO se envía a Siigo**, pero **SÍ suma** a ventas, dashboard e indicadores. Mostrar badge visible "⛔ NO FACTURA · suma a ventas" (negro + dorado, ver mockup).
4. **Shopify → O.P. automática**: pedido web con pago confirmado genera Orden de Pedido automáticamente y descuenta inventario. Webhook → cola `integracion_eventos` → worker.
5. **Semáforo de entrega de O.P.** (calculado, nunca almacenado): sin color >3 semanas · amarillo 2–3 semanas · rojo 1–2 semanas · **negro = vencido**. Aplica en lista, kanban, calendario y dashboard.
6. **Producto principal de una O.P.** con varios ítems: el rack; si no hay rack, el ítem de mayor precio. Mostrar "+N" por los demás.
7. **Inventario (metodología Simple Solutions)**: una sola bodega (sin columna bodega). Clasificación MTS (alta rotación, negro, stock permanente) / ATO (se personaliza color en pintura, premium) / MTO (a medida, premium alto). Reposición **por consumo** con **amortiguadores (buffers)**: verde <60% consumido, amarillo 60–85%, rojo >85% = comprar ya. Gráfico de tendencia de consumo por referencia.
8. **Solicitudes de compra**: un renglón por tipo de material (tubería, platinería, cojinería, tornillería, plásticos, insumos…) expandible a sus ítems. `valor_estimado` lo digita el comprador cuando los proveedores cotizan. Estados: Pendiente → En cotización → Comprado (habilita fecha de entrega) | Rechazada. Al recibir, logística marca ítem por ítem (✓ completo / ⚠ faltante con nota y seguimiento) hasta el cierre.
9. **Integraciones**: Siigo (facturación, API) y WhatsApp **solo vía Cloud API oficial de Meta** (el dueño teme baneos — nunca librerías no oficiales). Orígenes de O.P.: Shopify, WhatsApp, Planner (herramienta futura de diseño de espacios), Cotización.

## Screens / Views
Todas navegables en `ERP Bravefit.dc.html`. Menú superior carbón (#2B2B2B, 64px, sticky) con dropdowns al hover.

### Dashboard (5 pestañas)
- **Resumen**: 4 KPI cards (Ventas del mes, Pedidos activos, Pedidos vencidos en naranja #FD5C13, Entregados/récord), barras de ventas 6 meses (mes actual dorado #BE9A2E, resto #e4ddc9), ventas por ciudad (barras horizontales doradas), pedidos próximos a vencer (con chips de semáforo), redes sociales.
- **Comercial**: barras apiladas B2C (dorado) vs B2B (carbón) por mes, racks/poleas vendidos, top productos (unidades, barras horizontales).
- **Finanzas**: tabla PyG (concepto × meses + % abril vs meta con chip verde #E8F3EC/#1a7f4e o rojo #FCE9E3/#c2410c), posición de caja, card carbón de "lectura rápida". **Datos cargados manualmente** (regla 1).
- **Mercadeo**: tabla pauta vs facturación con retorno (×), cards de alianzas con impacto en caja dorada.
- **Operación**: nivel de servicio mensual (barras con semáforo vs meta 85% — línea punteada dorada), cumplidos/incumplidos, observaciones del mes.

### Ventas
- **Cotizaciones**: filtros por estado (chips pill), banner de reglas, tabla con columna SEGM. (chip B2B carbón / B2C dorado) y badge NO FACTURA cuando aplique.
- **CRM · Embudo**: 5 columnas drag & drop (Prospecto, Cotización enviada, Negociación, Ganada, Perdida — parametrizables). Fichas = oportunidades con cliente, cotización, valor dorado, días.
- **Lista de productos**: tabla con SKU, categoría, precio, stock, chip clasificación MTS/ATO/MTO, estado. Nota explicando la clasificación.
- **Catálogos**: cards con portada, contador de productos, botones Compartir/PDF.
- **Pedidos web · Shopify**: 3 pestañas — *Nuevas sin entregar* (pago/estado/O.P. generada "✓ auto"), *Histórico* (KPIs año + tabla), *Analítica* estilo Shopify (4 métricas clicables: Sesiones, Ventas, Pedidos, Conversión; gráfico de línea azul #1a91da actual vs anterior punteado #9ecdf2).
- **Análisis de ventas**: dimensiones por chips — cliente, vendedor, producto, ciudad, canal, **propio vs comercializado**, **B2B vs B2C**. Barras horizontales + cards resumen.

### Producción y Logística
- **Inventarios**: 4 KPIs, tabla con buffer/amortiguador (barra de consumo con semáforo), clasificación, tendencia de consumo por referencia (chips selectores).
- **Órdenes de pedido**: selector de vista **Lista / Kanban / Calendario** + leyenda del semáforo. Lista: O.P., cliente, ciudad, producto principal, chip origen, instalación Sí/No, etapa, chip entrega. Kanban: columnas = etapas de producción (Por iniciar, Fabricación, Pintura, Ensamble, Despacho), fichas arrastrables. Calendario mensual: O.P. ubicadas por fecha de entrega o de creación (toggle).
- **Detalle O.P.** (clic en cualquier O.P.): stepper de etapas, tabla de ítems con totales, cards de cliente/fechas/pago, botón Imprimir (versión imprimible formato taller pendiente — el dueño la está definiendo).
- **Solicitudes de compra**: renglones por tipo de material, expandibles (regla 8).
- **Garantías**: KPIs mes/año/% sobre entregas/tiempo medio, lista maestro-detalle (clic → detalle con O.P. original, problema, resolución).
- **Entregas**: KPIs mes/año/récord/promedio, barras por mes (récord dorado), últimas entregas.

### Mercadeo (módulo)
Campañas Meta/Google/TikTok (inversión, alcance, clics, leads, CPL), KPIs (ROAS), encuestas activas, redes sociales.

### Recursos Humanos
- **Empleados y nómina**: lista maestro-detalle; detalle = hoja de vida resumida (cédula, contrato, salario, EPS/ARL) + nómina liquidada (devengos, deducciones, neto). Botón "Liquidar nómina".
- **Vacaciones**: solicitudes con días/saldo/estado + botón Aprobar. Regla: máx. 2 personas de la misma área simultáneamente (alertar conflictos).
- **Evaluaciones de desempeño**: por ciclo (2026-1), puntaje /5 con barra, estados.
- **Reclutamiento**: cards por vacante con embudo Aplicaron → Entrevista → Finalistas.

### Cartelera (módulo propio, nivel superior)
Muro interno: **todos pueden publicar** (composer arriba), posts destacados (card carbón con badge IMPORTANTE dorado), reacciones 👍, sidebar de próximos eventos. Las noticias de Junta (showroom, molde de inyección, daño del torno, etc.) viven aquí.

## Interactions & Behavior
- Dropdowns del menú: abren al hover (mouseenter/mouseleave), fondo blanco, sombra 0 12px 32px rgba(0,0,0,.18), ítems con hover #F4F0E4/#8a6f1d.
- Drag & drop en CRM y Kanban de O.P.: arrastrar ficha entre columnas actualiza etapa (persistir + registrar en historial con usuario y timestamp).
- Navegación persiste la pantalla actual (el mockup usa localStorage; en producción, rutas URL).
- Filas de tabla: hover #faf9f7 (o #F4F0E4 si clicable), cursor pointer cuando abren detalle.
- Maestro-detalle (empleados, garantías): fila seleccionada con fondo #F4F0E4.
- Chips/tabs activos: fondo #2B2B2B texto blanco; inactivos blanco con borde #ddd.

## Design Tokens
- **Colores marca**: carbón `#2B2B2B` (header, botones primarios, texto) · dorado `#BE9A2E` (acento, activo, barras; hover `#d4af3a`; texto dorado oscuro `#8a6f1d`; dorado claro `#E8C55A` sobre carbón) · naranja `#FD5C13` (solo alertas/destacados) · gris claro `#D5D5D5`.
- **Fondos**: página `#F4F4F3` · cards `#fff` · sutil `#faf9f7` · dorado suave `#F4F0E4` · kanban `#EDECE9` · aviso `#FDF6E8` borde `#ecd9a3` texto `#7a5f14`.
- **Semánticos**: verde `#1a7f4e`/bg `#E8F3EC` · ámbar `#a06d10`/bg `#FDF3E4` · rojo `#c2410c`/bg `#FCE9E3` · azul `#3b5bb5`/bg `#EDF0FA` · neutro `#5a5a5a`/bg `#F0F0EE`.
- **Semáforo O.P.**: amarillo `#F5C518` (texto `#5a4a00`) · rojo `#E5484D` · vencido `#1a1a1a` (texto blanco).
- **Tipografía**: `'Helvetica Neue', Arial, sans-serif`. Título pantalla 26px/700 · sección 15px/700 · KPI 30px/800 · tabla 13px · headers de tabla 11.5px/600 uppercase letter-spacing .4px color `#8a8a8a` · chips 11px/700.
- **Radios**: cards 14px · chips/botones pill 99px · inputs 8-10px. Bordes `#ececea`. Sombra cards: ninguna o mínima; dropdowns sí.

## Assets
- `brand/logo-white.png`, `brand/logo-carbon.png` — logotipo BRAVEFIT (rediseño 2024, extraído del PDF del manual; pedir SVG original al dueño).
- `brand/mono2-carbon.png`, `brand/mono2-white.png` — monograma BF (avatar de usuario). También pedir vector original.
- Imágenes de producto: fondo blanco (estándar de marca). El mockup usa placeholders rayados.

## Files
- `ERP Bravefit.dc.html` + `support.js` — mockup navegable (abrir el .dc.html en navegador).
- `Esquema BD Bravefit.dc.html` — esquema de BD completo con llaves, relaciones y flujo principal.
- `brand/*` — assets de marca.
