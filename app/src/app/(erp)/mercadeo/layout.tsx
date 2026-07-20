import { exigirModulo } from "@/lib/permisos-server";

/** Guard por URL: Mercadeo es solo para roles con el módulo (Admins). */
export default async function MercadeoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await exigirModulo("mercadeo");
  return <>{children}</>;
}
