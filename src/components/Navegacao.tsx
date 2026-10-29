"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itens = [
  { href: "/", rotulo: "Início", icone: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/lancamentos", rotulo: "Lista", icone: "M4 6h16M4 12h16M4 18h10" },
  { href: "/cadastros", rotulo: "Ajustes", icone: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" },
];

export function Navegacao() {
  const caminho = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-tinta/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around px-2">
        {itens.slice(0, 2).map((i) => <Item key={i.href} {...i} ativo={caminho === i.href} />)}
        <Link
          href="/lancar"
          aria-label="Lançar"
          className="-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-tinta text-white shadow-lg active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
        {itens.slice(2).map((i) => <Item key={i.href} {...i} ativo={caminho === i.href} />)}
      </div>
    </nav>
  );
}

function Item({ href, rotulo, icone, ativo }: { href: string; rotulo: string; icone: string; ativo: boolean }) {
  return (
    <Link href={href} className={`flex w-20 flex-col items-center gap-1 py-2 text-xs ${ativo ? "text-tinta" : "text-tinta/50"}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d={icone} />
      </svg>
      {rotulo}
    </Link>
  );
}

export function Pagina({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-32 pt-6">
        {titulo && <h1 className="mb-5 text-2xl font-semibold">{titulo}</h1>}
        {children}
      </main>
      <Navegacao />
    </>
  );
}
