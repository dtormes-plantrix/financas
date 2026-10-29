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
  limite_usado: null,
  limite_atualizado_em: null,
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

import { compromissoNoMes, limitesDosCartoes, situacaoDasContas } from "../src/lib/painel";
import type { Compromisso, Conta } from "../src/lib/tipos";

const credito: Compromisso = {
  id: "cred", nome: "Crédito contratado", valor: 1014.22, dia_vencimento: null,
  mes_inicial: "2026-11", parcela_inicial: 7, total_parcelas: 18, valor_total: null, conta_id: null, ativo: true,
};
const joao: Compromisso = {
  id: "joao", nome: "Devolver poupança do João", valor: 500, dia_vencimento: null,
  mes_inicial: "2026-11", parcela_inicial: 1, total_parcelas: null, valor_total: 8500, conta_id: null, ativo: true,
};
const m = (ano: number, mes: number) => ({ ano, mes });

describe("parcelas mensais", () => {
  it("crédito: parcela 7 de 18 em novembro e acaba em outubro de 2027", () => {
    expect(compromissoNoMes(credito, m(2026, 10), [], "2026-10-29")).toBeNull();
    expect(compromissoNoMes(credito, m(2026, 11), [], "2026-10-29")?.rotulo).toBe("parcela 7 de 18");
    expect(compromissoNoMes(credito, m(2027, 10), [], "2026-10-29")?.rotulo).toBe("parcela 18 de 18");
    expect(compromissoNoMes(credito, m(2027, 11), [], "2026-10-29")).toBeNull();
  });

  it("pagamento tira do que falta no mês e entra no gasto à vista", () => {
    const pago = lanc({ valor: 1014.22, data: "2026-11-10", compromisso_id: "cred" });
    const r = resumoDoMes(m(2026, 11), {
      lancamentos: [pago], cartoes: [], fontes: [], faturasInformadas: [], compromissos: [credito], hoje: "2026-11-10",
    });
    expect(r.parcelas).toBe(0);
    expect(r.gastoAVista).toBe(1014.22);
    expect(r.sobra).toBe(-1014.22);
  });

  it("João: pagar mais num mês diminui o que falta, e a dívida acaba ao quitar", () => {
    const pagos = [lanc({ valor: 1000, data: "2026-11-05", compromisso_id: "joao" })];
    const nov = compromissoNoMes(joao, m(2026, 11), pagos, "2026-11-05")!;
    expect(nov.pago).toBe(1000);
    expect(nov.falta).toBe(0);
    expect(nov.rotulo.replace(/\s/g, " ")).toBe("depois deste mês faltam R$ 7.500,00");
    // 7.500 / 500 = 15 meses depois de novembro: último em fevereiro de 2028
    expect(compromissoNoMes(joao, m(2028, 2), pagos, "2026-11-05")?.devido).toBe(500);
    expect(compromissoNoMes(joao, m(2028, 3), pagos, "2026-11-05")).toBeNull();
  });

  it("João: sem pagar nada, termina em março de 2028 (17 meses)", () => {
    expect(compromissoNoMes(joao, m(2028, 3), [], "2026-10-29")?.rotulo).toBe("última parcela");
    expect(compromissoNoMes(joao, m(2028, 4), [], "2026-10-29")).toBeNull();
  });
});

describe("limites", () => {
  it("cartão: limite do app do banco mais compras lançadas depois", () => {
    const c = { ...cartao, limite_usado: 9525.04, limite_atualizado_em: "2026-10-06" };
    const compras = [
      lanc({ valor: 100, forma: "credito", cartao_id: "mp", data: "2026-10-01" }), // já estava no app
      lanc({ valor: 300, forma: "credito", cartao_id: "mp", data: "2026-10-20", parcelas: 3 }),
    ];
    const [l] = limitesDosCartoes([c], compras, "2026-10-29");
    expect(l.usado).toBe(9825.04);
    expect(l.livre).toBe(6174.96);
  });

  it("conta: saldo negativo vira cheque especial em uso", () => {
    const conta: Conta = {
      id: "sic", nome: "Sicredi", dono: "jo", limite_cheque_especial: 20000,
      saldo: -8746.2, saldo_atualizado_em: "2026-10-29", ativo: true,
    };
    const movimentos = [lanc({ tipo: "entrada", valor: 746.2, forma: "pix", conta_id: "sic", data: "2026-10-30" })];
    const [s] = situacaoDasContas([conta], movimentos);
    expect(s.saldo).toBe(-8000);
    expect(s.chequeEmUso).toBe(8000);
    expect(s.chequeLivre).toBe(12000);
  });
});
