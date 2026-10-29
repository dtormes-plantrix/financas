"use client";

import Link from "next/link";
import { useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { nomeMes, somarMeses, type Mes } from "@/lib/fatura";
import { dataCurta, NOME_DONO, NOME_FORMA, reais } from "@/lib/formato";
import { noMes } from "@/lib/painel";
import type { Dono, Forma } from "@/lib/tipos";

export default function Lancamentos() {
  const { dados } = useSessao();
  const d = new Date();
  const [mes, setMes] = useState<Mes>({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  const [pessoa, setPessoa] = useState<Dono | "todos">("todos");
  const [forma, setForma] = useState<Forma | "todas">("todas");

  const lista = dados.lancamentos
    .filter((l) => noMes(l.data, mes))
    .filter((l) => pessoa === "todos" || l.de_quem === pessoa)
    .filter((l) => forma === "todas" || l.forma === forma);

  const entradas = lista.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
  const saidas = lista.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);

  const porDia = new Map<string, typeof lista>();
  for (const l of lista) porDia.set(l.data, [...(porDia.get(l.data) ?? []), l]);

  const nome = (id: string | null, de: { id: string; nome: string }[]) => de.find((x) => x.id === id)?.nome;

  return (
    <Pagina>
      <div className="mb-4 flex items-center justify-between">
        <button aria-label="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))} className="botao-secundario px-4">‹</button>
        <h1 className="text-xl font-semibold capitalize">{nomeMes(mes, true)}</h1>
        <button aria-label="Próximo mês" onClick={() => setMes(somarMeses(mes, 1))} className="botao-secundario px-4">›</button>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {(["todos", "diego", "jo", "casa"] as const).map((p) => (
          <button key={p} onClick={() => setPessoa(p)} className={`chip shrink-0 py-2 text-sm ${pessoa === p ? "chip-ativo" : ""}`}>
            {p === "todos" ? "Todos" : NOME_DONO[p]}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(["todas", "pix", "credito", "debito", "dinheiro"] as const).map((f) => (
          <button key={f} onClick={() => setForma(f)} className={`chip shrink-0 py-2 text-sm ${forma === f ? "chip-ativo" : ""}`}>
            {f === "todas" ? "Todas" : NOME_FORMA[f]}
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="cartao">
          <div className="text-sm text-tinta/60">Entrou</div>
          <div className="text-xl font-semibold text-verde">{reais(entradas)}</div>
        </div>
        <div className="cartao">
          <div className="text-sm text-tinta/60">Saiu</div>
          <div className="text-xl font-semibold text-vermelho">{reais(saidas)}</div>
        </div>
      </div>

      {lista.length === 0 && (
        <p className="py-10 text-center text-tinta/60">
          Nada lançado neste mês ainda.{" "}
          <Link href="/lancar" className="underline">Lançar agora</Link>
        </p>
      )}

      {[...porDia.entries()].map(([dia, itens]) => (
        <section key={dia} className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-tinta/60">{dataCurta(dia)}</h2>
          <div className="cartao divide-y divide-tinta/5 p-0">
            {itens.map((l) => {
              const onde = l.forma === "credito" ? nome(l.cartao_id, dados.cartoes) : nome(l.conta_id, dados.contas);
              const titulo = l.descricao || nome(l.fonte_id, dados.fontes) || nome(l.categoria_id, dados.categorias) || (l.tipo === "entrada" ? "Entrada" : "Saída");
              return (
                <Link key={l.id} href={`/lancar?id=${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:bg-tinta/5">
                  <span className="min-w-0">
                    <span className="block truncate">{titulo}</span>
                    <span className="block text-xs text-tinta/50">
                      {NOME_FORMA[l.forma]}
                      {onde ? ` · ${onde}` : ""}
                      {l.parcelas > 1 ? ` · ${l.parcelas}x` : ""} · {NOME_DONO[l.de_quem]}
                    </span>
                  </span>
                  <span className={`shrink-0 font-medium tabular-nums ${l.tipo === "entrada" ? "text-verde" : ""}`}>
                    {l.tipo === "entrada" ? "+" : "−"} {reais(l.valor)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </Pagina>
  );
}
