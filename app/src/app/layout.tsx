import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ERP Bravefit",
    template: "%s · ERP Bravefit",
  },
  description: "ERP interno de Grupo Bravefit — equipos de gimnasio, Medellín.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-fondo text-carbon">
        {children}
      </body>
    </html>
  );
}
