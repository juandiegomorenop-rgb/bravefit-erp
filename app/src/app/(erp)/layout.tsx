import { ChatClaude } from "@/components/ChatClaude";
import { Header } from "@/components/Header";
import { NAV } from "@/lib/nav";
import { filtrarNav } from "@/lib/permisos";
import { cargarPermisos } from "@/lib/permisos-server";
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

  // Permisos reales del rol (tablas roles/permisos); el menú y el chat
  // se arman con esto. La seguridad de datos sigue siendo la RLS.
  const permisos = await cargarPermisos();
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
