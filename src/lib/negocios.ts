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
