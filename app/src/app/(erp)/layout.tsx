import { ChatClaude } from "@/components/ChatClaude";
import { Header } from "@/components/Header";
import { NAV } from "@/lib/nav";
import { filtrarNav, PERMISOS_ADMIN } from "@/lib/permisos";
import { createClient } from "@/lib/supabase/server";

/** Layout de la app autenticada: header + contenido. El middleware ya
 *  garantiza sesión; aquí solo se lee el usuario para el avatar. */
export default async function ErpLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let email: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  } catch {
    // Supabase sin configurar todavía (esqueleto): continuar sin usuario.
  }

  // TODO fase 1: cargar permisos reales del rol desde la tabla `permisos`.
  const permisos = PERMISOS_ADMIN;
  const nav = filtrarNav(NAV, permisos);
  const modulosVisibles = permisos.filter((p) => p.puede_ver).map((p) => p.modulo);

  return (
    <>
      <Header nav={nav} email={email} />
      <main className="flex-1">{children}</main>
      <ChatClaude modulos={modulosVisibles} />
    </>
  );
}
