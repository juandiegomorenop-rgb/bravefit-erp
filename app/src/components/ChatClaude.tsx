"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import type { Modulo } from "@/lib/permisos";

/**
 * Chat de Claude flotante, disponible en todo el ERP. Hereda los módulos que
 * el usuario puede ver (los pasa el layout) y consulta `/api/chat`, que corre
 * en el servidor (la API key nunca llega al navegador). Fase 1: consultas.
 */

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

const SUGERENCIAS = [
  "¿Cómo vamos en ventas este mes?",
  "¿Cuántas OPs están vencidas?",
  "Metros de tubería 70×70 procesados vs vendidos",
  "¿Qué materiales hay que reponer?",
];

export function ChatClaude({ modulos }: { modulos: Modulo[] }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [demo, setDemo] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
  }, [abierto]);

  async function enviar(texto: string) {
    const pregunta = texto.trim();
    if (!pregunta || cargando) return;
    const nuevos: Mensaje[] = [...mensajes, { role: "user", content: pregunta }];
    setMensajes(nuevos);
    setInput("");
    setCargando(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: nuevos, modulos }),
      });
      const data = await res.json();
      if (data.ok) {
        setDemo(Boolean(data.demo));
        setMensajes([...nuevos, { role: "assistant", content: data.reply }]);
      } else {
        setMensajes([
          ...nuevos,
          { role: "assistant", content: `⚠️ ${data.error ?? "Ocurrió un error."}` },
        ]);
      }
    } catch {
      setMensajes([
        ...nuevos,
        { role: "assistant", content: "⚠️ No pude conectar con el asistente." },
      ]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      {/* Burbuja flotante */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          aria-label="Abrir chat de Claude"
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-carbon text-dorado-claro shadow-[0_10px_30px_rgba(0,0,0,.28)] transition-transform hover:scale-105 print:hidden"
        >
          <Sparkles size={24} />
        </button>
      )}

      {/* Panel */}
      {abierto && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[min(620px,calc(100vh-2.5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,.3)] print:hidden">
          {/* Cabecera */}
          <div className="flex items-center gap-2 bg-carbon px-4 py-3 text-white">
            <Sparkles size={18} className="text-dorado-claro" />
            <div className="flex-1">
              <p className="text-[14px] font-semibold leading-tight">Asistente Claude</p>
              <p className="text-[11px] text-white/60 leading-tight">
                {demo ? "Modo demostración" : "Pregúntame sobre tus datos"}
              </p>
            </div>
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-4">
            {mensajes.length === 0 && (
              <div className="pt-2">
                <p className="text-[13px] text-neutral-500">
                  Hola 👋 Puedo consultar la información del ERP. Prueba con:
                </p>
                <div className="mt-3 space-y-2">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      onClick={() => enviar(s)}
                      className="block w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-left text-[12.5px] text-carbon transition-colors hover:border-dorado-claro hover:bg-dorado-suave"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-carbon text-white"
                      : "rounded-bl-sm border border-black/10 bg-white text-carbon"
                  }`}
                >
                  <Texto texto={m.content} />
                </div>
              </div>
            ))}

            {cargando && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-black/10 bg-white px-3.5 py-2 text-[13px] text-neutral-500">
                  <Loader2 size={14} className="animate-spin" />
                  Consultando…
                </div>
              </div>
            )}
            <div ref={finRef} />
          </div>

          {/* Entrada */}
          <div className="border-t border-black/10 bg-white p-3">
            <div className="flex items-end gap-2 rounded-xl border border-black/15 bg-white px-3 py-2 focus-within:border-dorado-claro">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviar(input);
                  }
                }}
                rows={1}
                placeholder="Escribe tu pregunta…"
                className="max-h-28 flex-1 resize-none bg-transparent text-[13px] text-carbon outline-none placeholder:text-neutral-400"
              />
              <button
                onClick={() => enviar(input)}
                disabled={cargando || !input.trim()}
                aria-label="Enviar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-carbon text-dorado-claro transition-opacity disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Render mínimo: negritas `**x**` y saltos de línea. Sin HTML crudo. */
function Texto({ texto }: { texto: string }) {
  return (
    <div className="whitespace-pre-wrap break-words">
      {texto.split("\n").map((linea, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {linea.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith("**") && parte.endsWith("**") ? (
              <strong key={j}>{parte.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{parte}</span>
            ),
          )}
        </span>
      ))}
    </div>
  );
}
