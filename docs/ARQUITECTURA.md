# ERP Bravefit — Arquitectura (v1)

## Stack (decidido)

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend + API | **Next.js 15 (App Router) + TypeScript + Tailwind CSS 4** | Un solo proyecto para UI y API routes; SSR rápido; mismo patrón de deploy que el Planner (Vercel). |
| Base de datos | **Supabase (PostgreSQL 15+)** | Postgres gestionado, Auth email/contraseña integrada, **Row Level Security** para RBAC a nivel de BD, Storage (hojas de vida, CVs, imágenes), backups automáticos. ~USD $25/mes plan Pro. |
| Auth | Supabase Auth (email + contraseña) | JWT con `rol` en claims; RLS lee el rol del token. |
| Hosting app | **Vercel** (deploy automático por `git push`, como el Planner) | Cero mantenimiento de servidores. |
| Dominio | `erp.bravefit.co` (CNAME en GoDaddy → Vercel) | |
| Chat IA | **Anthropic API** (claude) vía API route del servidor | Tool-use con consultas SQL de solo lectura que ejecutan BAJO el rol del usuario (fase 1); acciones (fase 2). La API key vive solo en el servidor. |
| Integraciones | API routes + `integracion_eventos` (cola en Postgres) + Vercel Cron para el worker | Webhooks Shopify (HMAC verificado) → cola → worker procesa → OP automática. Siigo API saliente. WhatsApp Cloud API oficial (fase posterior). |
| Gráficos | Recharts | Reproduce los gráficos del mockup (barras, líneas estilo Shopify). |
| Drag & drop | @dnd-kit | Kanban CRM y OPs. |

## Principios de seguridad

1. **RLS en TODAS las tablas** — la política de permisos vive en la base de datos. Aunque hubiera un bug en la app, un usuario Ops2 no puede leer salarios ni ventas: Postgres se lo niega.
2. Tres niveles de guard: RLS (BD) → middleware API (rol por módulo) → UI (menú/columnas ocultas). La UI es cosmética; la seguridad real está abajo.
3. `service_role` key SOLO en el servidor (workers/webhooks). El navegador usa siempre la `anon` key + JWT del usuario.
4. Webhooks Shopify: verificación HMAC-SHA256 obligatoria antes de encolar. Idempotencia por `shopify_order_id` UNIQUE.
5. Secretos en variables de entorno (Vercel/Supabase). Nunca en el repo. `.env.example` documenta las llaves necesarias sin valores.
6. Auditoría: trigger genérico que escribe en `auditoria` (usuario, tabla, registro, acción, cambios jsonb).
7. Borrado lógico (`activo`/`eliminado_en`) — nada se destruye.
8. Rate limiting en endpoints públicos; validación con Zod en cada API route.

## Estructura del repo

```
bravefit-erp/
├── docs/            REQUISITOS.md · ARQUITECTURA.md · DECISIONES.md
├── design/          handoff de Claude Design (mockup navegable + tokens + marca)
├── supabase/
│   ├── migrations/  SQL versionado (0001_esquema.sql, 0002_rls.sql, ...)
│   └── seed.sql     catálogos parametrizables + datos de ejemplo del mockup
└── app/             Next.js (creado en fase 1)
    ├── src/app/     rutas por módulo: dashboard/ ventas/ produccion/ mercadeo/ rrhh/ cartelera/
    ├── src/components/
    ├── src/lib/     supabase client, permisos, formato COP/fechas, semáforo
    └── src/server/  API routes: webhooks, siigo, chat claude, workers
```

## Fases de construcción

1. **Fundación** ✅ en curso: esquema BD + RLS + seed; scaffold Next.js; auth + layout + navegación data-driven por rol.
2. **Producción y Logística**: OPs (lista/kanban/calendario + detalle + semáforo), inventario con buffers, solicitudes de compra, garantías, entregas.
3. **Ventas**: productos, cotizaciones (plantilla planner), CRM kanban, análisis.
4. **Dashboard** (5 pestañas, PyG manual) + **Cartelera** + **RRHH** (vacaciones con festivos CO, evaluaciones, reclutamiento, empleados).
5. **Integraciones**: Shopify webhook→OP, Siigo facturas, chat Claude fase 1.
6. **Pulido**: responsive móvil, impresión OP, encuestas, mercadeo, chat Claude fase 2 (acciones).

## Checklist de cuentas (Juan) — necesarias para DESPLEGAR, no para desarrollar

1. **Supabase**: crear cuenta en supabase.com (con juanmoreno@bravefit.co), proyecto "bravefit-erp", región `sa-east-1` (São Paulo, la más cercana). Pasarme: Project URL, anon key, service_role key (por canal seguro, no por chat público).
2. **Vercel**: ya existe (Planner). Importar el repo nuevo cuando esté en GitHub.
3. **GoDaddy**: cuando avise, agregar CNAME `erp` → `cname.vercel-dns.com`.
4. **Siigo**: solicitar credenciales API (usuario API + access key) desde el panel Siigo Premium.
5. **Shopify**: crear webhook orders/paid hacia la URL que te daré (o lo hago yo vía MCP si me autorizas).
6. **Anthropic**: API key para el chat embebido (console.anthropic.com).

## Decisiones registradas

- Supabase sobre AWS puro: mismo Postgres, 10× menos superficie de operación para un equipo de 2 (Juan + Claude). Migrable a cualquier Postgres si algún día se necesita.
- El esquema borrador del handoff (`design/Esquema BD Bravefit.dc.html`, ~36 tablas) se toma como punto de partida y se endurece: llaves, índices, constraints, RLS, kardex y BOM del planner.
- Numeraciones: `BFP-NNNN` cotizaciones (continúa serie del planner) · `OP-XXX` · `GR-XXXX` · `SC-NNN` solicitudes de compra. Facturas: numeración de Siigo (el ERP guarda el número devuelto).
- PyG: captura manual (regla del dueño) — jamás calcular desde transacciones.
