"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itens: { href: string; rotulo: string; icone: string; soComputador?: boolean }[] = [
  { href: "/", rotulo: "Início", icone: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/mes", rotulo: "Detalhes do mês", soComputador: true, icone: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/lancamentos", rotulo: "Extrato", icone: "M4 6h16M4 12h16M4 18h10" },
  { href: "/negocios", rotulo: "Negócios", icone: "M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M4 13h16" },
  { href: "/cadastros", rotulo: "Ajustes", icone: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" },
];

export function Navegacao() {
  const caminho = usePathname();
  // No celular, Detalhes do mês abre tocando nos quadrinhos do Início.
  const doCelular = itens.filter((i) => !i.soComputador);
  return (
    <>
      {/* Celular: barra embaixo, com o botão de lançar no meio */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-tinta/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2">
          {doCelular.slice(0, 2).map((i) => <Item key={i.href} {...i} ativo={caminho === i.href} />)}
          <Link
            href="/lancar"
            aria-label="Lançar"
            className="-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-tinta text-white shadow-lg active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
          {doCelular.slice(2).map((i) => <Item key={i.href} {...i} ativo={caminho === i.href} />)}
        </div>
      </nav>

      {/* Computador: menu fixo do lado esquerdo */}
      <nav className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col gap-1 border-r border-tinta/10 bg-white px-3 py-6 lg:flex">
        <div className="mb-5 px-3 text-lg font-semibold">Finanças da casa</div>
        <Link href="/lancar" className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-tinta px-3 py-2.5 font-medium text-white hover:bg-tinta/90">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Lançar
        </Link>
        {itens.map((i) => {
          const ativo = caminho === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${ativo ? "bg-tinta/5 font-medium text-tinta" : "text-tinta/60 hover:bg-tinta/5"}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d={i.icone} />
              </svg>
              {i.rotulo}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function Item({ href, rotulo, icone, ativo }: { href: string; rotulo: string; icone: string; ativo: boolean }) {
  return (
    <Link href={href} className={`flex w-16 flex-col items-center gap-1 py-2 text-xs ${ativo ? "text-tinta" : "text-tinta/50"}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d={icone} />
      </svg>
      {rotulo}
    </Link>
  );
}

/** Página: no celular, uma coluna estreita; no computador, abre ao lado do menu. "larga" usa a tela toda (painéis). */
export function Pagina({ titulo, larga, children }: { titulo?: string; larga?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div className="lg:pl-56">
        <main className={`mx-auto max-w-md px-4 pb-32 pt-6 lg:px-8 lg:pb-12 lg:pt-10 ${larga ? "lg:max-w-6xl" : "lg:max-w-2xl"}`}>
          {titulo && <h1 className="mb-5 text-2xl font-semibold">{titulo}</h1>}
          {children}
        </main>
      </div>
      <Navegacao />
    </>
  );
}
