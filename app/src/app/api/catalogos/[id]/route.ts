import { NextResponse } from "next/server";
import { getCatalogosRepository } from "@/lib/data/catalogos";

/** Detalle de un catálogo (todas las versiones) para el historial de la tarjeta. */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detalle = await getCatalogosRepository().obtener(id);
  if (!detalle) return NextResponse.json({ versiones: [] }, { status: 404 });
  return NextResponse.json(detalle);
}
