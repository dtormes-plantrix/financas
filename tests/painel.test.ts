import { describe, expect, it } from "vitest";
import { resumoDoMes } from "../src/lib/painel";
import type { Cartao, FonteRenda, Lancamento } from "../src/lib/tipos";

const cartao: Cartao = {
  id: "mp",
  nome: "Mercado Pago",
  dono: "diego",
  limite: 16000,
  dia_fechamento: 5,
  dia_vencimento: 13,
  conta_pagamento_id: null,
  ativo: true,
};

const plantrix: FonteRenda = {
  id: "plantrix",
  nome: "Plantrix",
  valor_bruto: 9000,
  percentual_imposto: 6,
  dia_previsto: 5,
  conta_id: null,
  ativo: true,
};

let n = 0;
const lanc = (p: Partial<Lancamento>): Lancamento => ({
  id: String(++n),
  tipo: "saida",
  valor: 0,
  data: "2026-11-10",
  descricao: null,
  forma: "pix",
  conta_id: null,
  cartao_id: null,
  parcelas: 1,
  fonte_id: null,
  categoria_id: null,
  de_quem: "casa",
  criado_por: null,
  criado_em: "",
  ...p,
});

describe("resumo do mês", () => {
  it("conta renda líquida que falta, gasto à vista e fatura", () => {
    const lancamentos = [
      lanc({ valor: 200, forma: "pix" }),
      lanc({ valor: 50, forma: "dinheiro" }),
      // compra no crédito em 01/11 cai na fatura de novembro (fecha 5)
      lanc({ valor: 300, forma: "credito", cartao_id: "mp", data: "2026-11-01" }),
      // compra em 10/11 cai na fatura de dezembro
      lanc({ valor: 999, forma: "credito", cartao_id: "mp", data: "2026-11-10" }),
    ];
    const r = resumoDoMes(
      { ano: 2026, mes: 11 },
      { lancamentos, cartoes: [cartao], fontes: [plantrix], faturasInformadas: [] },
    );
    expect(r.aReceber).toBe(8460);
    expect(r.gastoAVista).toBe(250);
    expect(r.faturas).toBe(300);
    expect(r.sobra).toBe(8460 - 250 - 300);
  });

  it("renda recebida sai do 'a receber'", () => {
    const lancamentos = [lanc({ tipo: "entrada", valor: 8460, fonte_id: "plantrix" })];
    const r = resumoDoMes(
      { ano: 2026, mes: 11 },
      { lancamentos, cartoes: [cartao], fontes: [plantrix], faturasInformadas: [] },
    );
    expect(r.recebido).toBe(8460);
    expect(r.aReceber).toBe(0);
    expect(r.sobra).toBe(8460);
  });

  it("valor informado da fatura do banco vale no lugar do calculado", () => {
    const lancamentos = [lanc({ valor: 300, forma: "credito", cartao_id: "mp", data: "2026-11-01" })];
    const r = resumoDoMes(
      { ano: 2026, mes: 11 },
      {
        lancamentos,
        cartoes: [cartao],
        fontes: [],
        faturasInformadas: [{ id: "f", cartao_id: "mp", mes: "2026-11", valor: 4851.49 }],
      },
    );
    expect(r.faturas).toBe(4851.49);
  });
});
