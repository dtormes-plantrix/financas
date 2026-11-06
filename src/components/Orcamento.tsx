"use client";

// Barras do orçamento por categoria (casa e negócios) e as contas do mês
// usadas no painel e nos Detalhes do mês.

import Link from "next/link";
import { useSessao } from "@/components/Sessao";
import { somarMeses, type Mes } from "@/lib/fatura";
import { hoje, reais } from "@/lib/formato";
import { faltaGastar, gastosPorCategoria, type ItemOrcamento } from "@/lib/orcamento";
import { sobraPrevista } from "@/lib/negocios";
import { resumoDoMes } from "@/lib/painel";

export function mesDeHoje(): Mes {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

/** Valor sem centavos, para caber nos quadrinhos. */
export const curto = (v: number) => reais(Math.round(v)).replace(/,00$/, "");

/** Cor e frase do quadrinho da sobra. */
export function tom(sobra: number, base: number) {
  if (sobra < 0) return { fundo: "bg-vermelho-claro", texto: "text-vermelho", frase: "Vai faltar" };
  if (sobra < base * 0.1) return { fundo: "bg-amarelo-claro", texto: "text-amarelo", frase: "Apertado" };
  return { fundo: "bg-verde-claro", texto: "text-verde", frase: "Vai sobrar" };
}

/** Categorias da casa (as dos negócios ficam de fora). */
export function useCategoriasDaCasa() {
  const { dados } = useSessao();
  const dosNegocios = new Set(dados.grupos.filter((g) => g.negocio_id).map((g) => g.id));
  return dados.categorias.filter((c) => !c.grupo_id || !dosNegocios.has(c.grupo_id));
}

/**
 * As contas deste mês e do seguinte. O que ainda falta gastar do orçamento
 * deste mês entra como saída do mês seguinte (vai na fatura do cartão).
 */
export function useResumos() {
  const { dados } = useSessao();
  const dia = hoje();
  const atual = mesDeHoje();
  const seguinte = somarMeses(atual, 1);
  const categorias = useCategoriasDaCasa();
  const orcamento = gastosPorCategoria(categorias, dados.lancamentos, dados.regras, atual, dia, true);
  const base = { ...dados, hoje: dia };
  // Só o Studio passa sobra para a casa por enquanto (o Espaço ainda não).
  const queRepassam = dados.negocios.filter((n) => n.ativo && n.fonte_id && /studio/i.test(n.nome));
  const previsto = (m: Mes) =>
    Object.fromEntries(queRepassam.map((n) => [n.fonte_id!, sobraPrevista(n, m, dados.lancamentosNegocios)]));
  return {
    dia,
    orcamento,
    rAtual: resumoDoMes(atual, { ...base, previstoDasFontes: previsto(atual) }),
    rSeguinte: resumoDoMes(seguinte, { ...base, reservaOrcamento: faltaGastar(orcamento), previstoDasFontes: previsto(seguinte) }),
  };
}

const COR = {
  ok: { barra: "bg-verde", texto: "text-verde" },
  acima: { barra: "bg-amarelo", texto: "text-amarelo" },
  estourou: { barra: "bg-vermelho", texto: "text-vermelho" },
} as const;

export function BarraOrcamento({ item, ritmo }: { item: ItemOrcamento; ritmo: number }) {
  const { orcamento, gasto, situacao } = item;
  const cor = COR[situacao];
  const p = orcamento > 0 ? Math.min(100, (gasto / orcamento) * 100) : 0;
  const resto = orcamento - gasto;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate font-medium">{item.categoria.nome}</span>
        <span className="shrink-0 tabular-nums">
          <span className={`font-semibold ${situacao === "ok" ? "" : cor.texto}`}>{curto(gasto)}</span>
          <span className="text-tinta/50"> de {curto(orcamento)}</span>
        </span>
      </div>
      <div
        className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-tinta/10"
        role="meter"
        aria-label={`${item.categoria.nome}: ${Math.round((gasto / (orcamento || 1)) * 100)}% do orçamento`}
        aria-valuenow={Math.round(p)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${cor.barra}`} style={{ width: `${p}%` }} />
        {ritmo > 0 && ritmo < 1 && (
          <div className="absolute inset-y-0 w-0.5 bg-tinta/70" style={{ left: `${ritmo * 100}%` }} title="Onde deveria estar hoje" />
        )}
      </div>
      <div className={`mt-0.5 text-[11px] ${situacao === "ok" ? "text-tinta/50" : cor.texto}`}>
        {situacao === "estourou"
          ? `passou ${curto(-resto)} do orçamento`
          : situacao === "acima"
            ? `gastando rápido · ainda tem ${curto(resto)}`
            : `ainda tem ${curto(resto)}`}
      </div>
    </div>
  );
}

/** Bloco com uma barra por categoria que tem orçamento. */
export function BlocoOrcamento({ itens, ritmo, titulo = "Orçamento do mês", ajustes = "/cadastros" }: { itens: ItemOrcamento[]; ritmo: number; titulo?: string; ajustes?: string }) {
  const total = itens.reduce((s, i) => s + i.orcamento, 0);
  const gasto = itens.reduce((s, i) => s + i.gasto, 0);
  return (
    <div className="cartao mb-3 px-3 py-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-xs font-medium text-tinta/50">
        <span>{titulo}</span>
        {itens.length > 0 ? (
          <span className="shrink-0 whitespace-nowrap tabular-nums">{curto(gasto)} de {curto(total)}</span>
        ) : null}
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-tinta/60">
          Nenhuma categoria tem orçamento ainda. Ponha o valor por mês em{" "}
          <Link href={ajustes} className="underline">Ajustes</Link>.
        </p>
      ) : (
        <div className="space-y-2.5">
          {itens.map((i) => <BarraOrcamento key={i.categoria.id} item={i} ritmo={ritmo} />)}
        </div>
      )}
      {itens.length > 0 && ritmo > 0 && ritmo < 1 && (
        <p className="mt-2 text-[10px] text-tinta/50">O risquinho mostra onde o gasto deveria estar hoje para fechar o mês no orçamento.</p>
      )}
    </div>
  );
}
