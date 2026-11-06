"use client";

// Detalhes do mês: a conta linha a linha (o que entra e o que sai) e os
// gastos de cada categoria, com as compras. O Extrato continua sendo a lista
// de todos os lançamentos.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { BarraOrcamento, curto, tom, useCategoriasDaCasa, useResumos } from "@/components/Orcamento";
import { useSessao } from "@/components/Sessao";
import { nomeMes, somarMeses } from "@/lib/fatura";
import { dataCurta, NOME_FORMA, reais } from "@/lib/formato";
import { categoriaDe, gastosPorCategoria, ritmoDoMes, type ItemOrcamento } from "@/lib/orcamento";
import { noMes, type ResumoMes } from "@/lib/painel";

export default function DetalhesDoMes() {
  const { dados } = useSessao();
  const { dia, rAtual, rSeguinte } = useResumos();
  const [qual, setQual] = useState<"atual" | "seguinte">("atual");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("m") === "seguinte") setQual("seguinte");
  }, []);
  const r = qual === "atual" ? rAtual : rSeguinte;
  const categorias = useCategoriasDaCasa();
  const itens = gastosPorCategoria(categorias, dados.lancamentos, dados.regras, r.mes, dia);
  const semCategoria = dados.lancamentos.filter((l) => l.tipo === "saida" && noMes(l.data, r.mes) && !categoriaDe(l, dados.regras));

  return (
    <Pagina larga>
      <h1 className="mb-3 text-xl font-semibold lg:mb-6 lg:text-2xl">Detalhes do mês</h1>
      <div className="mb-3 grid grid-cols-2 gap-2 lg:max-w-xl">
        <Escolha r={rAtual} rotulo="Este mês" ativo={qual === "atual"} onClick={() => setQual("atual")} />
        <Escolha r={rSeguinte} rotulo="Mês que vem" ativo={qual === "seguinte"} onClick={() => setQual("seguinte")} />
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <Conta r={r} hoje={dia} />
        <Categorias itens={itens} ritmo={ritmoDoMes(r.mes, dia)} semCategoria={semCategoria.reduce((s, l) => s + Number(l.valor), 0)} qtdSem={semCategoria.length} mes={nomeMes(r.mes)} />
      </div>
    </Pagina>
  );
}

function Escolha({ r, rotulo, ativo, onClick }: { r: ResumoMes; rotulo: string; ativo: boolean; onClick: () => void }) {
  const t = tom(r.sobra, r.recebido + r.aReceber);
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-2xl px-3 py-2.5 text-left transition ${t.fundo} ${ativo ? "ring-2 ring-tinta/80" : "ring-1 ring-tinta/5"}`}
    >
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{rotulo}</span>
        <span className="capitalize text-tinta/60">{nomeMes(r.mes)}</span>
      </div>
      <div className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${t.texto}`}>{curto(r.sobra)}</div>
      <div className="text-xs text-tinta/70">{t.frase}</div>
    </button>
  );
}

/** Gastos do mês por categoria. As que têm orçamento vêm primeiro, com a barra. */
function Categorias({ itens, ritmo, semCategoria, qtdSem, mes }: { itens: ItemOrcamento[]; ritmo: number; semCategoria: number; qtdSem: number; mes: string }) {
  return (
    <div className="cartao mb-3 p-0 text-sm">
      <div className="px-3 pt-2 text-xs font-medium text-tinta/50">Gastos de {mes} por categoria</div>
      {itens.length === 0 && qtdSem === 0 && <p className="px-3 py-2 text-tinta/60">Nenhum gasto lançado neste mês.</p>}
      {itens.map((i) => (
        <details key={i.categoria.id} className="group border-t border-tinta/5 first-of-type:border-t-0">
          <summary className="cursor-pointer list-none px-3 py-2 [&::-webkit-details-marker]:hidden">
            {i.orcamento > 0 ? (
              <BarraOrcamento item={i} ritmo={ritmo} />
            ) : (
              <div className="flex items-center justify-between">
                <span>{i.categoria.nome}</span>
                <span className="tabular-nums">{reais(i.gasto)}</span>
              </div>
            )}
          </summary>
          <div className="pb-2">
            {i.lancamentos.length === 0 && <p className="px-3 pl-6 text-xs text-tinta/50">Nada lançado ainda.</p>}
            {i.lancamentos.map((l) => (
              <Link key={l.id} href={`/lancar?id=${l.id}`} className="flex items-center justify-between gap-2 px-3 py-0.5 pl-6 text-xs text-tinta/60">
                <span className="truncate">{dataCurta(l.data)} · {l.descricao || "sem descrição"} · {NOME_FORMA[l.forma]}</span>
                <span className="shrink-0 tabular-nums">{reais(Number(l.valor))}</span>
              </Link>
            ))}
          </div>
        </details>
      ))}
      {qtdSem > 0 && (
        <Link href="/lancamentos" className="flex items-center justify-between border-t border-tinta/5 bg-amarelo-claro/60 px-3 py-2">
          <span>{qtdSem} {qtdSem === 1 ? "gasto" : "gastos"} sem categoria <span className="underline">escolher</span></span>
          <span className="tabular-nums">{reais(semCategoria)}</span>
        </Link>
      )}
    </div>
  );
}

/**
 * A conta do mês escolhido: entrada prevista menos saída prevista dá a sobra.
 * "Já entrou" e "Já saiu" mostram quanto disso já aconteceu.
 */
function Conta({ r, hoje: dia }: { r: ResumoMes; hoje: string }) {
  const semFatura = r.itensFatura.some((f) => f.informado === null);
  const entrada = r.recebido + r.aReceber;
  const saida = r.gastoAVista + r.faturas + r.parcelas + r.orcamento;
  const fixas = r.itensCompromisso.reduce((s, c) => s + Math.max(c.devido, c.pago), 0);
  const outros = saida - r.faturas - fixas - r.orcamento;
  const deFontes = r.rendas.reduce((s, x) => s + x.recebido, 0);
  const outrasEntradas = r.recebido - deFontes;
  const ehAtual = noMes(dia, r.mes);
  const diaHoje = Number(dia.slice(8, 10));
  const faturasPagas = ehAtual
    ? r.itensFatura.filter((f) => f.cartao.dia_vencimento < diaHoje).reduce((s, f) => s + f.valor, 0)
    : 0;
  const saiu = r.gastoAVista + faturasPagas;

  return (
    <div className="cartao mb-3 p-0 text-sm">
      <div className="px-3 pt-2 text-xs font-medium text-tinta/50">Conta de {nomeMes(r.mes)}</div>

      <Abre rotulo="Entrada prevista" valor={entrada} cor="text-verde">
        {r.rendas.map((x) => (
          <Sub
            key={x.fonte.id}
            rotulo={`${x.fonte.nome}${x.falta > 0 ? (x.recebido > 0 ? ` · falta ${curto(x.falta)}` : " · ainda não entrou") : " · entrou"}`}
            valor={Math.max(x.previsto, x.recebido)}
          />
        ))}
        {Math.abs(outrasEntradas) >= 0.01 && <Sub rotulo="Outras entradas" valor={outrasEntradas} />}
      </Abre>
      <Ja rotulo="Já entrou" valor={r.recebido} />

      <Abre rotulo="Saída prevista" valor={-saida}>
        {r.itensFatura.map((f) => (
          <Sub
            key={f.cartao.id}
            rotulo={`Fatura ${f.cartao.nome} · dia ${f.cartao.dia_vencimento}${f.informado === null ? " · parcial" : ""}`}
            valor={-f.valor}
          />
        ))}
        {semFatura && (
          <p className="px-3 pb-1 pl-6 text-[11px] text-tinta/50">
            Digite a fatura do app do banco em <Link href="/cadastros" className="underline">Ajustes</Link> para o número ficar certo.
          </p>
        )}
        {r.itensCompromisso.map((c) => (
          <Sub
            key={c.compromisso.id}
            rotulo={`${c.compromisso.nome}${c.falta > 0 ? "" : " · pago"}`}
            valor={-Math.max(c.devido, c.pago)}
          />
        ))}
        {r.orcamento > 0 && (
          <Sub rotulo={`Orçamento de ${nomeMes(somarMeses(r.mes, -1))} que falta gastar (vai na fatura)`} valor={-r.orcamento} />
        )}
        {Math.abs(outros) >= 0.01 && <Sub rotulo="Outros gastos já lançados" valor={-outros} />}
        {r.itensCompromisso.length > 0 && (
          <p className="px-3 pb-1 pl-6 text-[11px] text-tinta/50">
            Para dar baixa numa parcela, use o <Link href="/lancamentos" className="underline">Extrato</Link>.
          </p>
        )}
      </Abre>
      <Ja rotulo="Já saiu" valor={-saiu} />

      <div className="flex items-center justify-between border-t border-tinta/10 px-3 py-2 font-semibold">
        <span>Sobra</span>
        <span className={`tabular-nums ${r.sobra < 0 ? "text-vermelho" : "text-verde"}`}>{reais(r.sobra)}</span>
      </div>
    </div>
  );
}

/** Linha pequena logo abaixo do previsto: quanto disso já aconteceu. */
function Ja({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between px-3 pb-1.5 pl-6 text-xs text-tinta/50">
      <span>{rotulo}</span>
      <span className="tabular-nums">{reais(valor)}</span>
    </div>
  );
}

/** No computador há espaço: os detalhes já começam abertos. */
function useTelaGrande() {
  const [grande, setGrande] = useState(false);
  useEffect(() => setGrande(window.matchMedia("(min-width: 1024px)").matches), []);
  return grande;
}

function Abre({ rotulo, valor, cor, children }: { rotulo: string; valor: number; cor?: string; children?: React.ReactNode }) {
  const grande = useTelaGrande();
  const linha = (
    <>
      <span className="flex items-center gap-1">
        {rotulo}
        {children && <span aria-hidden className="text-tinta/30 transition group-open:rotate-90">›</span>}
      </span>
      <span className={`tabular-nums ${cor ?? ""}`}>{reais(valor)}</span>
    </>
  );
  if (!children) {
    return <div className="flex items-center justify-between border-t border-tinta/5 px-3 py-1.5">{linha}</div>;
  }
  return (
    <details open={grande || undefined} className="group border-t border-tinta/5">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-1.5 [&::-webkit-details-marker]:hidden">{linha}</summary>
      <div className="pb-1">{children}</div>
    </details>
  );
}

function Sub({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-0.5 pl-6 text-xs text-tinta/60">
      <span>{rotulo}</span>
      <span className="shrink-0 tabular-nums">{reais(valor)}</span>
    </div>
  );
}

