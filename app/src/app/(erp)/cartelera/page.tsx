import { getCarteleraRepository } from "@/lib/data/cartelera";
import { CarteleraClient } from "./CarteleraClient";

export const metadata = { title: "Cartelera" };

export default async function Page() {
  const publicaciones = await getCarteleraRepository().listar();
  return <CarteleraClient publicaciones={publicaciones} />;
}
