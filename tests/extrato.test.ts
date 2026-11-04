import { describe, expect, it } from "vitest";
import { lerArquivo, limparDescricao } from "../src/lib/extrato/leitores";
import { conciliar } from "../src/lib/extrato/conciliar";
import { montarLinhas } from "../src/lib/extrato/texto";
import type { Cartao, Conta, Lancamento } from "../src/lib/tipos";

// Textos de exemplo no formato que o leitor de PDF monta (colunas separadas por 3 espaços).
const SICREDI_EXTRATO = `Associado: FULANA
Extrato (Período de 01/10/2026 a 31/10/2026)
Data   Descrição   Documento   Valor (R$)   Saldo (R$)
SALDO ANTERIOR   -1.000,00
02/10/2026   PAGAMENTO PIX 06564773188 Padaria Boa   PIX_DEB   -48,00   -1.048,00
05/10/2026   TRANSF ENTRE CONTAS 24793736068 SADY ELIAS SOLET   SI00010   10.638,00   9.590,00
14/10/2026   DEB.CTA.FATURA   032303586   -3.799,79   5.790,21
15/10/2026   RECEBIMENTO PIX 85523968153 DIEGO TORMES   PIX_CRED   2.000,00   7.790,21`;

const NUBANK_FATURA = `Olá, Fulana.
Data de vencimento: 27 OUT 2026
Nu Pagamentos S.A.
Total a pagar   R$ 452,90
TRANSAÇÕES   DE 20 SET A 20 OUT
20 SET   •••• 4191   Lojas Renner - Parcela 3/3   R$ 144,66
22 SET   Uber - NuPay   R$ 14,95
17 OUT   •••• 4191   Mercado Bom   R$ 293,29
28 SET   Pagamento em 28 SET   −R$ 1.000,00`;

const MP_EXTRATO = `EXTRATO DE CONTA
Periodo: De 01-10-2026 al 28-10-2026
Saldo inicial: R$ 1.000,00   Saldo final: R$ 696,00
DETALHE DOS MOVIMENTOS
Data   Descrição   ID da operação   Valor   Saldo

Pix enviado Loja de
01-10-2026   180797126331   R$ -299,00   R$ 701,00
Ferragens

Pagamento com Pix
02-10-2026   PADARIA   181964455456   R$ -5,00   R$ 696,00
BOA VISTA
Data de geração: 29-10-2026`;

const contas: Conta[] = [
  { id: "mp", nome: "Mercado Pago", dono: "diego", limite_cheque_especial: null, saldo: null, saldo_atualizado_em: null, ativo: true },
  { id: "sic", nome: "Sicredi", dono: "jo", limite_cheque_especial: 20000, saldo: null, saldo_atualizado_em: null, ativo: true },
];
const cartoes: Cartao[] = [
  { id: "nu", nome: "Nubank", dono: "jo", limite: null, dia_fechamento: 20, dia_vencimento: 27, conta_pagamento_id: null, limite_usado: null, limite_atualizado_em: null, ativo: true },
];
const fontes = [{ id: "sady", nome: "Ajuda do Sady", valor_bruto: null, percentual_imposto: 0, dia_previsto: 5, conta_id: "sic", ativo: true }];

function lanc(p: Partial<Lancamento>): Lancamento {
  return {
    id: crypto.randomUUID(), tipo: "saida", valor: 0, data: "2026-10-01", descricao: null, forma: "pix", conta_id: null,
    cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: null, criado_em: "", ...p,
  };
}

describe("leitores", () => {
  it("lê o extrato do Sicredi e confere com o saldo", () => {
    const a = lerArquivo(SICREDI_EXTRATO)!;
    expect(a.banco).toBe("sicredi");
    expect(a.tipo).toBe("extrato");
    expect(a.itens).toHaveLength(4);
    expect(a.confere).toBe(true);
    expect(a.itens[0]).toMatchObject({ data: "2026-10-02", descricao: "Padaria Boa", valor: 48, sinal: "sai" });
  });

  it("lê a fatura do Nubank, com a data da compra parcelada", () => {
    const a = lerArquivo(NUBANK_FATURA)!;
    expect(a.tipo).toBe("fatura");
    expect(a.confere).toBe(true);
    const renner = a.itens.find((i) => i.descricao === "Lojas Renner")!;
    expect(renner.parcela).toEqual({ numero: 3, de: 3 });
    expect(renner.data).toBe("2026-07-20"); // parcela 3 em setembro: compra em julho
  });

  it("junta a descrição quebrada em várias linhas no extrato do Mercado Pago", () => {
    const a = lerArquivo(MP_EXTRATO)!;
    expect(a.confere).toBe(true);
    expect(a.itens.map((i) => i.descricao)).toEqual(["Loja de Ferragens", "PADARIA BOA VISTA"]);
  });

  it("limpa os códigos do banco", () => {
    expect(limparDescricao("LIQUIDACAO BOLETO 31222129000178 LEONARDO SARNO")).toBe("LEONARDO SARNO");
    expect(limparDescricao("Pagamento de parcela Empréstimos")).toBe("Pagamento de parcela Empréstimos");
  });

  it("monta as linhas pela posição do texto no PDF", () => {
    const t = montarLinhas([
      { str: "Saldo", x: 200, y: 700, w: 30, h: 10 },
      { str: "Data", x: 10, y: 700, w: 20, h: 10 },
      { str: "01/10", x: 10, y: 600, w: 25, h: 10 },
    ]);
    expect(t).toBe("Data   Saldo\n\n01/10");
  });
});

describe("conciliar", () => {
  it("separa o que já foi lançado, o que falta e o que fica fora", () => {
    const a = lerArquivo(SICREDI_EXTRATO)!;
    const ls = conciliar(a, { tipo: "conta", id: "sic" }, {
      contas, cartoes, fontes,
      lancamentos: [lanc({ valor: 48, data: "2026-10-03", conta_id: "sic" })],
    });
    expect(ls.map((l) => l.situacao)).toEqual(["lancado", "falta", "fora", "falta"]);
    expect(ls[1].novo).toMatchObject({ tipo: "entrada", fonte_id: "sady", conta_id: "sic", criado_por: null });
    // Pix do Diego para a Jô vira "entre contas"
    expect(ls[3].novo).toMatchObject({ tipo: "transferencia", conta_id: "mp", conta_destino_id: "sic" });
  });

  it("na fatura, a compra parcelada entra com o total e reconhece a já lançada", () => {
    const a = lerArquivo(NUBANK_FATURA)!;
    const ls = conciliar(a, { tipo: "cartao", id: "nu" }, {
      contas, cartoes, fontes,
      lancamentos: [lanc({ valor: 14.95, data: "2026-09-22", forma: "credito", cartao_id: "nu" })],
    });
    const renner = ls.find((l) => l.item.descricao === "Lojas Renner")!;
    expect(renner.novo).toMatchObject({ valor: 433.98, parcelas: 3, forma: "credito", cartao_id: "nu" });
    expect(ls.find((l) => l.item.descricao === "Uber - NuPay")!.situacao).toBe("lancado");
    expect(ls.find((l) => l.item.descricao.startsWith("Pagamento"))!.situacao).toBe("fora");
  });

  it("importar o mesmo arquivo de novo não lança nada duas vezes", () => {
    const a = lerArquivo(SICREDI_EXTRATO)!;
    const base = { contas, cartoes, fontes, lancamentos: [] as Lancamento[] };
    const novos = conciliar(a, { tipo: "conta", id: "sic" }, base).filter((l) => l.marcado).map((l) => lanc(l.novo!));
    const de_novo = conciliar(a, { tipo: "conta", id: "sic" }, { ...base, lancamentos: novos });
    expect(de_novo.filter((l) => l.situacao === "falta")).toHaveLength(0);
  });
});
