import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  ejecutarHerramienta,
  responderDemo,
  systemPrompt,
  toolDefs,
} from "@/lib/data/chat";
import { MODULOS, type Modulo } from "@/lib/permisos";

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

const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
const MAX_ITERACIONES = 6;

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
