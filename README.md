# ERP Bravefit

ERP interno de Grupo Bravefit (Medellín, Colombia). Módulos: Dashboard, Ventas, Producción y Logística, Mercadeo, Recursos Humanos y Cartelera.

- **Requisitos**: [docs/REQUISITOS.md](docs/REQUISITOS.md) — fuente de verdad del negocio.
- **Arquitectura**: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) — stack, seguridad, fases.
- **Diseño**: [design/](design/) — handoff de Claude Design (abrir `ERP Bravefit.dc.html` en navegador). Tokens y reglas en `design/README.md`.
- **Base de datos**: [supabase/migrations/](supabase/migrations/) + [supabase/seed.sql](supabase/seed.sql).
- **App**: `app/` — Next.js 15 + TypeScript + Tailwind (en construcción).

## Stack
Next.js 15 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + Auth + RLS + Storage) · Vercel · Anthropic API (chat embebido).

## Desarrollo
```bash
cd app
pnpm install
pnpm dev
```
Variables de entorno: copiar `app/.env.example` → `app/.env.local` (llaves de Supabase y Anthropic — nunca commitear).
