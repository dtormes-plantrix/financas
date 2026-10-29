// Contas do painel: quanto sobra no mês atual e no mês seguinte.
//
// sobra = entradas já recebidas + rendas previstas que ainda não entraram
//         − saídas à vista (pix, débito, dinheiro)
//         − faturas de cartão que vencem no mês

import { chaveMes, lerData, parcelasDaCompra, type Mes } from "./fatura";
import type { Cartao, FaturaInformada, FonteRenda, Lancamento } from "./tipos";

export type ItemFatura = {
  cartao: Cartao;
  calculado: number; // soma das compras registradas no sistema
  informado: number | null; // valor digitado a partir da fatura do banco
  valor: number; // o que vale para a conta
};

export type ItemRenda = { fonte: FonteRenda; previsto: number; recebido: number; falta: number };

export type ResumoMes = {
  mes: Mes;
  recebido: number;
  aReceber: number;
  gastoAVista: number;
  faturas: number;
  sobra: number;
  rendas: ItemRenda[];
  itensFatura: ItemFatura[];
};

const r2 = (v: number) => Math.round(v * 100) / 100;

export function liquido(fonte: FonteRenda): number {
  if (!fonte.valor_bruto) return 0;
  return r2(fonte.valor_bruto * (1 - (fonte.percentual_imposto || 0) / 100));
}

export function noMes(data: string, mes: Mes): boolean {
  const d = lerData(data);
  return d.ano === mes.ano && d.mes === mes.mes;
}

/** Soma, por cartão, as parcelas de compras registradas que caem na fatura do mês. */
export function faturasCalculadas(lancamentos: Lancamento[], cartoes: Cartao[], mes: Mes) {
  const chave = chaveMes(mes);
  const porCartao = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || l.forma !== "credito" || !l.cartao_id) continue;
    const cartao = cartoes.find((c) => c.id === l.cartao_id);
    if (!cartao) continue;
    for (const p of parcelasDaCompra(l.data, Number(l.valor), l.parcelas || 1, cartao)) {
      if (chaveMes(p.fatura) === chave) {
        porCartao.set(cartao.id, r2((porCartao.get(cartao.id) || 0) + p.valor));
      }
    }
  }
  return porCartao;
}

export function resumoDoMes(
  mes: Mes,
  dados: {
    lancamentos: Lancamento[];
    cartoes: Cartao[];
    fontes: FonteRenda[];
    faturasInformadas: FaturaInformada[];
  },
): ResumoMes {
  const { lancamentos, cartoes, fontes, faturasInformadas } = dados;
  const doMes = lancamentos.filter((l) => noMes(l.data, mes));

  const recebido = r2(doMes.filter((l) => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0));

  const rendas: ItemRenda[] = fontes
    .filter((f) => f.ativo && f.valor_bruto)
    .map((fonte) => {
      const previsto = liquido(fonte);
      const rec = r2(
        doMes
          .filter((l) => l.tipo === "entrada" && l.fonte_id === fonte.id)
          .reduce((s, l) => s + Number(l.valor), 0),
      );
      return { fonte, previsto, recebido: rec, falta: r2(Math.max(0, previsto - rec)) };
    });
  const aReceber = r2(rendas.reduce((s, r) => s + r.falta, 0));

  const gastoAVista = r2(
    doMes
      .filter((l) => l.tipo === "saida" && l.forma !== "credito")
      .reduce((s, l) => s + Number(l.valor), 0),
  );

  const calculadas = faturasCalculadas(lancamentos, cartoes, mes);
  const chave = chaveMes(mes);
  const itensFatura: ItemFatura[] = cartoes
    .filter((c) => c.ativo)
    .map((cartao) => {
      const calculado = calculadas.get(cartao.id) || 0;
      const inf = faturasInformadas.find((f) => f.cartao_id === cartao.id && f.mes === chave);
      const informado = inf ? Number(inf.valor) : null;
      // O valor informado vem da fatura do banco e já inclui o que foi registrado aqui.
      return { cartao, calculado, informado, valor: informado ?? calculado };
    });
  const faturas = r2(itensFatura.reduce((s, f) => s + f.valor, 0));

  return {
    mes,
    recebido,
    aReceber,
    gastoAVista,
    faturas,
    sobra: r2(recebido + aReceber - gastoAVista - faturas),
    rendas,
    itensFatura,
  };
}
