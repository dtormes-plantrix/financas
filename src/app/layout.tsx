import type { Metadata, Viewport } from "next";
import { Sessao } from "@/components/Sessao";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanças da casa",
  description: "Diego e Jô: quanto sobra este mês e no mês que vem.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone.svg", apple: "/icone-180.png" },
  appleWebApp: { capable: true, title: "Finanças", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f4ef",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Sessao>{children}</Sessao>
      </body>
    </html>
  );
}
