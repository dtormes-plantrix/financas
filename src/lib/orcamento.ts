// Orçamento por categoria: quanto se quer gastar por mês e quanto já foi.
//
// Lançamento sem categoria entra na categoria da regra cujo texto aparece na
// descrição (ex.: "Comper Mt" tem "comper" -> Mercado). A regra de texto mais
// longo vence.

import { diasNoMes, lerData, type Mes } from "./fatura";
import { noMes } from "./painel";
import type { Categoria, Lancamento, RegraCategoria } from "./tipos";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Minúsculas, sem acento e sem espaços repetidos. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto que vira regra quando a pessoa escolhe a categoria de uma compra. */
export function buscaDaDescricao(descricao: string | null | undefined): string {
  return normalizar(descricao)
    .replace(/[*#]/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function regraPara(descricao: string | null | undefined, regras: RegraCategoria[]): RegraCategoria | undefined {
  const d = normalizar(descricao);
  if (!d) return undefined;
  let melhor: RegraCategoria | undefined;
  for (const r of regras) {
    const b = normalizar(r.busca);
    if (b && d.includes(b) && (!melhor || b.length > normalizar(melhor.busca).length)) melhor = r;
  }
  return melhor;
}

/** A categoria do lançamento: a escolhida, ou a da regra que combina com a descrição. */
export function categoriaDe(l: Lancamento, regras: RegraCategoria[]): string | null {
  if (l.categoria_id) return l.categoria_id;
  if (l.tipo !== "saida") return null;
  return regraPara(l.descricao, regras)?.categoria_id ?? null;
}

export type Situacao = "ok" | "acima" | "estourou";

export type ItemOrcamento = {
  categoria: Categoria;
  orcamento: number; // 0 = sem orçamento
  gasto: number;
  esperado: number; // quanto "devia" ter gasto até hoje, no ritmo do mês
  situacao: Situacao;
  lancamentos: Lancamento[];
};

/** Fração do mês que já passou (0 no futuro, 1 no passado). */
export function ritmoDoMes(mes: Mes, hoje: string): number {
  const d = lerData(hoje);
  const a = mes.ano * 12 + mes.mes;
  const h = d.ano * 12 + d.mes;
  if (a < h) return 1;
  if (a > h) return 0;
  return d.dia / diasNoMes(mes);
}

export function situacao(gasto: number, orcamento: number, esperado: number): Situacao {
  if (orcamento <= 0) return "ok";
  if (gasto > orcamento) return "estourou";
  // folga de 10% do orçamento para não ficar amarelo por causa de uma compra só
  if (gasto > esperado + orcamento * 0.1) return "acima";
  return "ok";
}

/**
 * Gastos do mês por categoria. `soComOrcamento` deixa só as que têm valor por mês.
 * Saídas apenas; transferências e entradas não contam.
 */
export function gastosPorCategoria(
  categorias: Categoria[],
  lancamentos: Lancamento[],
  regras: RegraCategoria[],
  mes: Mes,
  hoje: string,
  soComOrcamento = false,
): ItemOrcamento[] {
  const ritmo = ritmoDoMes(mes, hoje);
  const porCategoria = new Map<string, Lancamento[]>();
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || !noMes(l.data, mes)) continue;
    const id = categoriaDe(l, regras);
    if (!id) continue;
    porCategoria.set(id, [...(porCategoria.get(id) ?? []), l]);
  }
  return categorias
    .map((categoria) => {
      const ls = (porCategoria.get(categoria.id) ?? []).sort((a, b) => (a.data < b.data ? 1 : -1));
      const orcamento = Number(categoria.orcamento) || 0;
      const gasto = r2(ls.reduce((s, l) => s + Number(l.valor), 0));
      const esperado = r2(orcamento * ritmo);
      return { categoria, orcamento, gasto, esperado, situacao: situacao(gasto, orcamento, esperado), lancamentos: ls };
    })
    .filter((i) => (soComOrcamento ? i.orcamento > 0 : i.orcamento > 0 || i.gasto > 0))
    .sort((a, b) => (b.orcamento > 0 ? 1 : 0) - (a.orcamento > 0 ? 1 : 0) || b.gasto - a.gasto);
}

/**
 * O que ainda falta gastar do orçamento do mês. Como quase tudo é pago no
 * cartão, isso vai pesar na fatura do mês seguinte.
 */
export function faltaGastar(itens: ItemOrcamento[]): number {
  return r2(itens.reduce((s, i) => s + Math.max(0, i.orcamento - i.gasto), 0));
}
