import { exigirModulo } from "@/lib/permisos-server";

/** Guard por URL: Producción y Logística según permisos del rol. */
export default async function ProduccionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await exigirModulo("produccion");
  return <>{children}</>;
}
