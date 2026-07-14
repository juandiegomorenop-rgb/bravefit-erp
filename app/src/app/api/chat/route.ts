import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  ejecutarHerramienta,
  responderDemo,
  systemPrompt,
  toolDefs,
} from "@/lib/data/chat";
import { MODULOS, type Modulo } from "@/lib/permisos";
import { createClient } from "@/lib/supabase/server";

/**
 * Chat de Claude embebido — ejecuta SIEMPRE en el servidor.
 * La ANTHROPIC_API_KEY nunca se expone al cliente. Sin key configurada,
 * la ruta responde en "modo demo" (intent-match sobre datos mock) para que
 * el chat funcione desde ya; con la key, corre el loop real de tool-use.
 *
 * SEGURIDAD (fase de mock): los `modulos` llegan del cliente. Cuando Supabase
 * esté conectado, el servidor derivará los módulos del JWT del usuario y las
 * herramientas consultarán la BD con RLS — el cliente ya no será fuente de
 * verdad de permisos.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modelo del chat. Sonnet 5: rápido y económico para consultas internas.
// Para cambiarlo, edita esta línea (no depende de variables de Vercel).
const MODELO = "claude-sonnet-5";
const MAX_ITERACIONES = 6;

// Límite de uso por usuario (control de costo del chat con Claude).
const LIMITE_CONSULTAS = 30;
const VENTANA_MINUTOS = 10;

interface MensajeCliente {
  role: "user" | "assistant";
  content: string;
}

function normalizarModulos(entrada: unknown): Modulo[] {
  if (!Array.isArray(entrada)) return [];
  return entrada.filter((m): m is Modulo => MODULOS.includes(m as Modulo));
}

export async function POST(req: Request) {
  let body: { mensajes?: MensajeCliente[]; modulos?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const mensajes = (body.mensajes ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  if (mensajes.length === 0) {
    return NextResponse.json({ ok: false, error: "Sin mensajes." }, { status: 400 });
  }
  const modulos = normalizarModulos(body.modulos);
  const ultima = mensajes[mensajes.length - 1];

  // ---- Identificar usuario (por su sesión, no por el cliente) y
  //      aplicar el límite de uso. Global: se cuenta en Supabase, así
  //      funciona entre instancias serverless de Vercel. --------------
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ ok: false, error: "Sesión no válida." }, { status: 401 });
      }
      const desde = new Date(Date.now() - VENTANA_MINUTOS * 60_000).toISOString();
      const { count } = await supabase
        .from("chat_uso")
        .select("*", { count: "exact", head: true })
        .eq("usuario_id", user.id)
        .gte("en", desde);
      if ((count ?? 0) >= LIMITE_CONSULTAS) {
        return NextResponse.json(
          {
            ok: false,
            error: `Alcanzaste el límite de ${LIMITE_CONSULTAS} consultas en ${VENTANA_MINUTOS} minutos. Espera un momento y vuelve a intentar.`,
          },
          { status: 429 },
        );
      }
      await supabase.from("chat_uso").insert({ usuario_id: user.id });
    } catch {
      // Si Supabase falla, no bloqueamos el chat por el límite; seguimos.
    }
  }

  // ---- Modo demo: sin API key ---------------------------------
  if (!process.env.ANTHROPIC_API_KEY) {
    const { reply, herramienta } = await responderDemo(ultima.content, modulos);
    return NextResponse.json({
      ok: true,
      reply,
      herramientas: herramienta ? [herramienta] : [],
      demo: true,
    });
  }

  // ---- Modo real: loop de tool-use ----------------------------
  const client = new Anthropic();
  const system = systemPrompt(modulos);
  const tools = toolDefs(modulos);

  const conversacion: Anthropic.MessageParam[] = mensajes.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const herramientasUsadas: string[] = [];

  try {
    for (let i = 0; i < MAX_ITERACIONES; i++) {
      const resp = await client.messages.create({
        model: MODELO,
        max_tokens: 2048,
        system,
        tools,
        messages: conversacion,
      });

      if (resp.stop_reason === "refusal") {
        return NextResponse.json({
          ok: true,
          reply: "No puedo responder eso.",
          herramientas: herramientasUsadas,
          demo: false,
        });
      }

      const toolUses = resp.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
        const texto = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        return NextResponse.json({
          ok: true,
          reply: texto || "(sin respuesta)",
          herramientas: herramientasUsadas,
          demo: false,
        });
      }

      conversacion.push({ role: "assistant", content: resp.content });

      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        herramientasUsadas.push(tu.name);
        const salida = await ejecutarHerramienta(
          tu.name,
          (tu.input ?? {}) as Record<string, unknown>,
          modulos,
        );
        resultados.push({ type: "tool_result", tool_use_id: tu.id, content: salida });
      }
      conversacion.push({ role: "user", content: resultados });
    }

    return NextResponse.json({
      ok: true,
      reply: "La consulta requirió demasiados pasos. Intenta una pregunta más específica.",
      herramientas: herramientasUsadas,
      demo: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Error de Claude: ${msg}` }, { status: 502 });
  }
}
