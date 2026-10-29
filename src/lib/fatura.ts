// Regra da fatura do cartão.
//
// Compra feita até o dia de fechamento (inclusive) entra na fatura que fecha
// naquele mês. Compra feita depois do fechamento entra na fatura seguinte.
// A fatura recebe o nome do mês de vencimento ("fatura de outubro" vence em outubro),
// que é como os três bancos (Mercado Pago, Sicredi, Nubank) chamam.

export type RegraCartao = {
  dia_fechamento: number;
  dia_vencimento: number;
};

export type Mes = { ano: number; mes: number }; // mes de 1 a 12

export function somarMeses(m: Mes, n: number): Mes {
  const total = m.ano * 12 + (m.mes - 1) + n;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

export function diasNoMes(m: Mes): number {
  return new Date(Date.UTC(m.ano, m.mes, 0)).getUTCDate();
}

/** "2026-10-29" -> { ano: 2026, mes: 10, dia: 29 } */
export function lerData(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return { ano, mes, dia };
}

export function chaveMes(m: Mes): string {
  return `${m.ano}-${String(m.mes).padStart(2, "0")}`;
}

/** Mês em que a fatura que recebe esta compra fecha. */
export function mesDeFechamento(dataCompra: string, cartao: RegraCartao): Mes {
  const d = lerData(dataCompra);
  const mes: Mes = { ano: d.ano, mes: d.mes };
  const fechamento = Math.min(cartao.dia_fechamento, diasNoMes(mes));
  return d.dia <= fechamento ? mes : somarMeses(mes, 1);
}

/** Mês de vencimento (nome da fatura) a partir do mês de fechamento. */
export function mesDeVencimento(fechamento: Mes, cartao: RegraCartao): Mes {
  // Se o vencimento é um dia depois do fechamento, vence no mesmo mês
  // (ex.: fecha 5, vence 13). Se não, vence no mês seguinte (fecha 28, vence 13).
  return cartao.dia_vencimento > cartao.dia_fechamento ? fechamento : somarMeses(fechamento, 1);
}

/** Em qual fatura (mês de vencimento) uma compra à vista no crédito cai. */
export function faturaDaCompra(dataCompra: string, cartao: RegraCartao): Mes {
  return mesDeVencimento(mesDeFechamento(dataCompra, cartao), cartao);
}

/** Divide o valor em parcelas, em centavos, com a sobra dos centavos na primeira. */
export function dividirParcelas(valor: number, parcelas: number): number[] {
  const n = Math.max(1, Math.floor(parcelas));
  const centavos = Math.round(valor * 100);
  const base = Math.floor(centavos / n);
  const resto = centavos - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? resto : 0)) / 100);
}

export type ParcelaFatura = { numero: number; de: number; valor: number; fatura: Mes };

/** Todas as parcelas de uma compra no crédito, cada uma na sua fatura. */
export function parcelasDaCompra(
  dataCompra: string,
  valor: number,
  parcelas: number,
  cartao: RegraCartao,
): ParcelaFatura[] {
  const primeira = faturaDaCompra(dataCompra, cartao);
  const valores = dividirParcelas(valor, parcelas);
  return valores.map((v, i) => ({
    numero: i + 1,
    de: valores.length,
    valor: v,
    fatura: somarMeses(primeira, i),
  }));
}

const NOMES_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeMes(m: Mes, comAno = false): string {
  return comAno ? `${NOMES_MES[m.mes - 1]} de ${m.ano}` : NOMES_MES[m.mes - 1];
}
