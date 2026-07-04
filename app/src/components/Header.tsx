"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import type { NavItem } from "@/lib/nav";

/**
 * Header carbón 64px sticky con menú horizontal, dropdowns al hover
 * y avatar con monograma. En móvil colapsa a hamburguesa.
 * Recibe la navegación YA filtrada por permisos (filtrarNav).
 */
export function Header({ nav, email }: { nav: NavItem[]; email: string | null }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const esActivo = (item: NavItem) =>
    item.href === "/"
      ? pathname === "/"
      : pathname.startsWith(`/${item.href.split("/")[1]}`);

  return (
    <header className="sticky top-0 z-50 h-16 bg-carbon text-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Inicio">
          <Image
            src="/brand/logo-white.png"
            alt="BRAVEFIT"
            width={132}
            height={28}
            priority
            className="h-6 w-auto"
          />
        </Link>

        {/* Menú de escritorio */}
        <nav className="hidden h-full flex-1 items-center gap-1 lg:flex">
          {nav.map((item) => (
            <div key={item.label} className="group relative flex h-16 items-center">
              <Link
                href={item.href}
                className={`flex items-center gap-1 rounded-pill px-3 py-2 text-[13.5px] font-semibold transition-colors ${
                  esActivo(item)
                    ? "text-dorado-claro"
                    : "text-white/85 hover:text-dorado-claro"
                }`}
              >
                {item.label}
                {item.children && (
                  <ChevronDown size={14} className="opacity-70" />
                )}
              </Link>

              {item.children && (
                <div className="invisible absolute left-0 top-full min-w-56 rounded-b-[10px] bg-white py-2 opacity-0 shadow-[0_12px_32px_rgba(0,0,0,.18)] transition-opacity duration-100 group-hover:visible group-hover:opacity-100">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-4 py-2 text-[13px] font-medium text-carbon hover:bg-dorado-suave hover:text-dorado-oscuro"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Avatar con monograma */}
          <div
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-dorado-claro"
            title={email ?? "Usuario"}
          >
            <Image
              src="/brand/mono2-carbon.png"
              alt={email ?? "Usuario"}
              width={20}
              height={20}
              className="h-5 w-auto"
            />
          </div>

          {/* Hamburguesa (móvil / tablet) */}
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="rounded-md p-2 text-white/85 hover:text-dorado-claro lg:hidden"
            aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={abierto}
          >
            {abierto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      {abierto && (
        <nav className="max-h-[calc(100vh-64px)] overflow-y-auto border-t border-white/10 bg-carbon pb-4 lg:hidden">
          {nav.map((item) => (
            <div key={item.label}>
              <Link
                href={item.href}
                onClick={() => !item.children && setAbierto(false)}
                className={`block px-6 py-3 text-[14px] font-semibold ${
                  esActivo(item) ? "text-dorado-claro" : "text-white/90"
                }`}
              >
                {item.label}
              </Link>
              {item.children?.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setAbierto(false)}
                  className="block px-10 py-2 text-[13px] text-white/70 hover:text-dorado-claro"
                >
                  {child.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
