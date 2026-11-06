// Caixa de cada negócio (Studio Pilates, Espaço Soletti).
//
// Os lançamentos do negócio ficam fora das contas da casa. O que a Jô passa
// para a casa é lançado como renda da casa (fonte ligada ao negócio) e, aqui,
// sai do caixa do negócio como "passado para a casa".

import type { Mes } from "./fatura";
import { noMes } from "./painel";
import type { Grupo, Lancamento, Negocio } from "./tipos";

export const NOME_GRUPO: Record<Grupo, string> = {
  aluno: "Aluno",
  aluguel: "Aluguel",
  fixa: "Despesa fixa",
  variavel: "Despesa variável",
  outra: "Outra entrada",
};

export type ResumoNegocio = {
  entradas: number;
  fixas: number;
  variaveis: number;
  resultado: number; // entradas − despesas do mês
  passado: number; // o que foi para a casa no mês
  caixa: number; // o que está guardado no negócio até o fim do mês
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const soma = (ls: Lancamento[]) => r2(ls.reduce((s, l) => s + Number(l.valor), 0));

/** Lançamentos da casa que são sobras vindas deste negócio. */
export function repassesDoNegocio(n: Negocio, lancamentosCasa: Lancamento[]): Lancamento[] {
  if (!n.fonte_id) return [];
  return lancamentosCasa.filter((l) => l.tipo === "entrada" && l.fonte_id === n.fonte_id);
}

export function resumoNegocio(
  n: Negocio,
  mes: Mes,
  lancamentosNegocio: Lancamento[],
  lancamentosCasa: Lancamento[],
): ResumoNegocio {
  const doNegocio = lancamentosNegocio.filter((l) => l.negocio_id === n.id);
  const repasses = repassesDoNegocio(n, lancamentosCasa);
  const doMes = doNegocio.filter((l) => noMes(l.data, mes));
  const entradas = soma(doMes.filter((l) => l.tipo === "entrada"));
  const fixas = soma(doMes.filter((l) => l.tipo === "saida" && l.grupo === "fixa"));
  const variaveis = soma(doMes.filter((l) => l.tipo === "saida" && l.grupo !== "fixa"));
  const passado = soma(repasses.filter((l) => noMes(l.data, mes)));

  const fim = `${mes.ano}-${String(mes.mes).padStart(2, "0")}-31`;
  const ate = (ls: Lancamento[]) => ls.filter((l) => l.data <= fim);
  const caixa = r2(
    soma(ate(doNegocio).filter((l) => l.tipo === "entrada")) -
      soma(ate(doNegocio).filter((l) => l.tipo === "saida")) -
      soma(ate(repasses)),
  );

  return { entradas, fixas, variaveis, resultado: r2(entradas - fixas - variaveis), passado, caixa };
}

export type Pagador = { nome: string; valor: number };
export type PrevisaoEntradas = {
  jaEntrou: number; // tudo que entrou no mês
  faltam: Pagador[]; // quem pagou no mês anterior e ainda não pagou neste
  previsto: number; // jaEntrou + o que falta
  seguinte: Pagador[]; // quem deve pagar no mês seguinte
  previstoSeguinte: number;
  fixas: number; // despesas fixas que devem se repetir no mês seguinte
};

// Mensalidade de aluno e aluguel de sala se repetem todo mês. "Outra entrada" não.
const RECORRENTE: Grupo[] = ["aluno", "aluguel"];

/** Nome de quem pagou, sem "mensalidade", "aluguel" e números, para achar a mesma pessoa no outro mês. */
export function chavePagador(descricao: string | null | undefined): string {
  return (descricao ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(mensalidade|mensal|pagamento|pix|ref\.?|referente|de|do|da)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pagadores(ls: Lancamento[]): Map<string, Pagador> {
  const m = new Map<string, Pagador>();
  for (const l of ls) {
    if (l.tipo !== "entrada" || !RECORRENTE.includes(l.grupo as Grupo)) continue;
    const k = chavePagador(l.descricao);
    if (!k) continue;
    const atual = m.get(k);
    m.set(k, { nome: l.descricao!.trim(), valor: r2((atual?.valor ?? 0) + Number(l.valor)) });
  }
  return m;
}

/**
 * Previsão das entradas: quem pagou mensalidade (ou aluguel) no mês anterior
 * deve pagar de novo. Para o mês seguinte, vale quem pagou neste mês mais quem
 * ainda falta pagar.
 */
export function previsaoEntradas(n: Negocio, mes: Mes, lancamentosNegocio: Lancamento[]): PrevisaoEntradas {
  const doNegocio = lancamentosNegocio.filter((l) => l.negocio_id === n.id);
  const doMes = doNegocio.filter((l) => noMes(l.data, mes));
  const anterior = { ano: mes.mes === 1 ? mes.ano - 1 : mes.ano, mes: mes.mes === 1 ? 12 : mes.mes - 1 };
  const pagaram = pagadores(doMes);
  const antes = pagadores(doNegocio.filter((l) => noMes(l.data, anterior)));
  const faltam = [...antes].filter(([k]) => !pagaram.has(k)).map(([, p]) => p).sort((a, b) => b.valor - a.valor);
  const jaEntrou = soma(doMes.filter((l) => l.tipo === "entrada"));
  const seguinte = [...pagaram.values(), ...faltam].sort((a, b) => b.valor - a.valor);
  return {
    jaEntrou,
    faltam,
    previsto: r2(jaEntrou + faltam.reduce((s, p) => s + p.valor, 0)),
    seguinte,
    previstoSeguinte: r2(seguinte.reduce((s, p) => s + p.valor, 0)),
    fixas: soma(doMes.filter((l) => l.tipo === "saida" && l.grupo === "fixa")),
  };
}
