import { exigirModulo } from "@/lib/permisos-server";

/** Guard por URL: Ventas es solo para roles con el módulo (Admins). */
export default async function VentasLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await exigirModulo("ventas");
  return <>{children}</>;
}
