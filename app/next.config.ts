import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad (hallazgo de auditoría). Se omite CSP a propósito:
 * una CSP estricta rompe estilos/inline de Next+Supabase y hay que afinarla
 * con cuidado — se hará en su propio paso. Estas cuatro son seguras y no
 * afectan el funcionamiento.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // anti-clickjacking
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
