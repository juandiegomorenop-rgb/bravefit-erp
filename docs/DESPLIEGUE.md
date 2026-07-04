# Despliegue — ERP Bravefit

## Arquitectura de producción

```
Navegador (PC/celular/tablet)
        │ HTTPS
        ▼
erp.bravefit.co  (DNS GoDaddy → CNAME a Vercel)
        │
   Next.js en Vercel  ──────────►  Supabase (Postgres + Auth + RLS + Storage)
        │                               ▲
   API routes (workers):                │ service_role (solo servidor)
   webhooks Shopify, sync Siigo,        │
   chat Claude (Anthropic API)  ────────┘
```

## Lo que hace Juan (una sola vez, ~15 min)

1. **Supabase**: crear cuenta en https://supabase.com (plan Free alcanza para
   arrancar; Pro US$25/mes cuando estemos en producción por los backups diarios).
   - New project → nombre `bravefit-erp` → región `East US (North Virginia)`
     (la más cercana a Colombia) → guardar la **contraseña de la base de datos**.
   - En Settings → API: copiar `Project URL`, `anon key`, `service_role key`.
   - En https://supabase.com/dashboard/account/tokens: generar **Access Token**
     (para que Claude pueda aplicar migraciones con el CLI).
2. **Vercel**: crear cuenta en https://vercel.com con el mismo GitHub donde
   está el repo (o crear repo GitHub primero — Claude lo deja listo).
3. **GoDaddy**: cuando el deploy exista, agregar CNAME `erp` → `cname.vercel-dns.com`.
4. Pasarle a Claude: Project URL, anon key, service_role key, access token y
   contraseña de BD (por esta sesión; van a `.env.local`, JAMÁS al repo).

## Lo que hace Claude con eso

```bash
cd app && npx supabase login --token <ACCESS_TOKEN>
npx supabase link --project-ref <ref del Project URL>
npx supabase db push          # aplica 0001 + 0002
# seed: SQL editor o psql con la contraseña de BD
```

- Crear los 5 usuarios en Supabase Auth (emails del equipo) y sus filas en
  `usuarios` con el rol correspondiente.
- Configurar `.env.local` de la app y variables en Vercel.
- Webhook Shopify → `https://erp.bravefit.co/api/webhooks/shopify` (HMAC verificado).

## Reglas de seguridad no negociables

- `service_role key` y `ANTHROPIC_API_KEY` viven SOLO en el servidor
  (variables de entorno Vercel). El navegador solo conoce la anon key.
- RLS activo en el 100% de las tablas: la autorización vive en Postgres.
- El chat Claude corre en API route del servidor y hereda el rol del usuario
  autenticado (consulta la BD CON el JWT del usuario, nunca con service_role).
- Webhooks: verificación HMAC (Shopify) y firma (Siigo) antes de encolar.
- Backups: Supabase Pro hace backup diario; adicionalmente `pg_dump` semanal
  automatizado a Storage.
