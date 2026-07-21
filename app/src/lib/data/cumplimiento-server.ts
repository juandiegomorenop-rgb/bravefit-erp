/**
 * Cumplimiento REAL (server-only): se calcula sobre las MISMAS OPs de
 * Supabase que alimentan el kanban y las entregas — una sola fuente de
 * verdad. La fecha comprometida es `fecha_entrega_original` (congelada
 * por el trigger trg_congelar_fecha_entrega).
 */
import {
  calcularCumplimiento,
  opsParaCumplimiento,
  type ResumenCumplimiento,
} from "@/lib/data/cumplimiento";
import { getOpsRepository } from "@/lib/data/ops-server";

export async function resumenCumplimiento(
  meses = 12,
): Promise<ResumenCumplimiento> {
  const cards = await getOpsRepository().listarOps();
  return calcularCumplimiento(opsParaCumplimiento(cards), meses);
}
