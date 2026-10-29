// Contas do painel: quanto sobra no mês atual e no mês seguinte.
//
// sobra = entradas já recebidas + rendas previstas que ainda não entraram
//         − saídas à vista (pix, débito, dinheiro)
//         − faturas de cartão que vencem no mês
//         − parcelas mensais (empréstimo, dívida) que ainda não foram pagas

import { chaveMes, lerData, parcelasDaCompra, somarMeses, type Mes } from "./fatura";
import type { Cartao, Compromisso, Conta, FaturaInformada, FonteRenda, Lancamento } from "./tipos";

export type ItemFatura = {
  cartao: Cartao;
  calculado: number; // soma das compras registradas no sistema
  informado: number | null; // valor digitado a partir da fatura do banco
  valor: number; // o que vale para a conta
};

export type ItemRenda = { fonte: FonteRenda; previsto: number; recebido: number; falta: number };

export type ItemCompromisso = {
  compromisso: Compromisso;
  rotulo: string; // "parcela 7 de 18" ou "faltam R$ 8.000,00"
  devido: number;
  pago: number;
  falta: number;
};

export type ResumoMes = {
  mes: Mes;
  recebido: number;
  aReceber: number;
  gastoAVista: number;
  faturas: number;
  parcelas: number; // o que falta pagar das parcelas mensais
  sobra: number;
  rendas: ItemRenda[];
  itensFatura: ItemFatura[];
  itensCompromisso: ItemCompromisso[];
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

export function lerMes(chave: string): Mes {
  const [ano, mes] = chave.split("-").map(Number);
  return { ano, mes };
}

const indice = (m: Mes) => m.ano * 12 + m.mes;
const reaisBR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Quanto se deve de uma parcela mensal no mês, e quanto já foi pago nele. */
export function compromissoNoMes(
  c: Compromisso,
  mes: Mes,
  lancamentos: Lancamento[],
  hoje: string,
): ItemCompromisso | null {
  if (!c.ativo) return null;
  const inicio = lerMes(c.mes_inicial);
  if (indice(mes) < indice(inicio)) return null;
  const pagamentos = lancamentos.filter((l) => l.compromisso_id === c.id && l.tipo === "saida");
  const pagoEm = (m: Mes) => r2(pagamentos.filter((l) => noMes(l.data, m)).reduce((s, l) => s + Number(l.valor), 0));
  const pago = pagoEm(mes);

  if (c.valor_total) {
    // Dívida: o que resta depende do que já foi pago. Para meses futuros,
    // conta que os meses do meio vão ser pagos no valor combinado.
    const atual = lerData(hoje);
    const mesHoje: Mes = { ano: atual.ano, mes: atual.mes };
    let restante = c.valor_total - pagamentos.filter((l) => indice(lerMes(l.data.slice(0, 7))) < indice(mes)).reduce((s, l) => s + Number(l.valor), 0);
    for (let k = mesHoje; indice(k) < indice(mes); k = somarMeses(k, 1)) {
      if (indice(k) < indice(inicio)) continue;
      restante -= Math.max(0, Math.min(c.valor, restante) - pagoEm(k));
    }
    restante = r2(Math.max(0, restante));
    if (restante <= 0 && pago <= 0) return null;
    const devido = r2(Math.min(c.valor, restante));
    const depois = r2(Math.max(0, restante - Math.max(pago, devido)));
    return {
      compromisso: c,
      rotulo: depois > 0 ? `depois deste mês faltam ${reaisBR(depois)}` : "última parcela",
      devido,
      pago,
      falta: r2(Math.max(0, devido - pago)),
    };
  }

  const numero = c.parcela_inicial + (indice(mes) - indice(inicio));
  if (c.total_parcelas && numero > c.total_parcelas) return null;
  return {
    compromisso: c,
    rotulo: c.total_parcelas ? `parcela ${numero} de ${c.total_parcelas}` : "todo mês",
    devido: Number(c.valor),
    pago,
    falta: r2(Math.max(0, Number(c.valor) - pago)),
  };
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
    compromissos?: Compromisso[];
    hoje?: string;
  },
): ResumoMes {
  const { lancamentos, cartoes, fontes, faturasInformadas, compromissos = [] } = dados;
  const hoje = dados.hoje ?? new Date().toISOString().slice(0, 10);
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

  const itensCompromisso = compromissos
    .map((c) => compromissoNoMes(c, mes, lancamentos, hoje))
    .filter((x): x is ItemCompromisso => x !== null);
  const parcelas = r2(itensCompromisso.reduce((s, c) => s + c.falta, 0));

  return {
    mes,
    recebido,
    aReceber,
    gastoAVista,
    faturas,
    parcelas,
    sobra: r2(recebido + aReceber - gastoAVista - faturas - parcelas),
    rendas,
    itensFatura,
    itensCompromisso,
  };
}

// ---------- limites ----------

export type LimiteCartao = {
  cartao: Cartao;
  limite: number;
  usado: number;
  livre: number;
  desde: string | null; // data em que o limite usado foi copiado do app do banco
};

/**
 * Limite usado do cartão: o valor copiado do app do banco, mais as compras
 * lançadas aqui depois disso. Sem valor copiado, soma as parcelas ainda por pagar
 * das compras lançadas aqui.
 */
export function limitesDosCartoes(cartoes: Cartao[], lancamentos: Lancamento[], hoje: string): LimiteCartao[] {
  const d = lerData(hoje);
  const mesHoje: Mes = { ano: d.ano, mes: d.mes };
  return cartoes
    .filter((c) => c.ativo && c.limite)
    .map((cartao) => {
      const compras = lancamentos.filter((l) => l.tipo === "saida" && l.forma === "credito" && l.cartao_id === cartao.id);
      let usado: number;
      if (cartao.limite_usado !== null && cartao.limite_usado !== undefined) {
        const desde = cartao.limite_atualizado_em ?? "";
        usado = Number(cartao.limite_usado) + compras.filter((l) => l.data > desde).reduce((s, l) => s + Number(l.valor), 0);
      } else {
        usado = compras
          .flatMap((l) => parcelasDaCompra(l.data, Number(l.valor), l.parcelas || 1, cartao))
          .filter((p) => indice(p.fatura) >= indice(mesHoje))
          .reduce((s, p) => s + p.valor, 0);
      }
      usado = r2(usado);
      const limite = Number(cartao.limite);
      return { cartao, limite, usado, livre: r2(limite - usado), desde: cartao.limite_atualizado_em };
    });
}

export type SituacaoConta = {
  conta: Conta;
  saldo: number | null; // estimado: valor copiado do banco + lançamentos depois dele
  chequeEmUso: number;
  chequeLivre: number | null;
  desde: string | null;
};

export function situacaoDasContas(contas: Conta[], lancamentos: Lancamento[]): SituacaoConta[] {
  return contas
    .filter((c) => c.ativo)
    .map((conta) => {
      if (conta.saldo === null || conta.saldo === undefined) {
        return { conta, saldo: null, chequeEmUso: 0, chequeLivre: conta.limite_cheque_especial, desde: null };
      }
      const desde = conta.saldo_atualizado_em ?? "";
      const movimento = lancamentos
        .filter((l) => l.conta_id === conta.id && l.forma !== "credito" && l.data > desde)
        .reduce((s, l) => s + (l.tipo === "entrada" ? 1 : -1) * Number(l.valor), 0);
      const saldo = r2(Number(conta.saldo) + movimento);
      const chequeEmUso = r2(Math.max(0, -saldo));
      const chequeLivre = conta.limite_cheque_especial ? r2(Number(conta.limite_cheque_especial) - chequeEmUso) : null;
      return { conta, saldo, chequeEmUso, chequeLivre, desde: conta.saldo_atualizado_em };
    });
}

/**
 * O que ainda vai mexer nas contas até o fim do mês atual: rendas que faltam
 * entrar, faturas que ainda vão vencer e parcelas que faltam pagar.
 */
export function pendenteAteFimDoMes(r: ResumoMes, hoje: string): number {
  const dia = lerData(hoje).dia;
  const faturasPorVir = r.itensFatura
    .filter((f) => f.cartao.dia_vencimento >= dia)
    .reduce((s, f) => s + f.valor, 0);
  return r2(r.aReceber - faturasPorVir - r.parcelas);
}
