import { describe, expect, it } from "vitest";
import { chaveMes, dividirParcelas, faturaDaCompra, parcelasDaCompra } from "../src/lib/fatura";

// Regras reais tiradas das faturas de outubro de 2026.
const mercadoPago = { dia_fechamento: 5, dia_vencimento: 13 };
const sicredi = { dia_fechamento: 28, dia_vencimento: 13 };
const nubank = { dia_fechamento: 20, dia_vencimento: 27 };

const fatura = (data: string, c: { dia_fechamento: number; dia_vencimento: number }) =>
  chaveMes(faturaDaCompra(data, c));

describe("regra da fatura", () => {
  it("Mercado Pago: compra até o dia 5 vence no dia 13 do mesmo mês", () => {
    expect(fatura("2026-10-05", mercadoPago)).toBe("2026-10");
    expect(fatura("2026-09-06", mercadoPago)).toBe("2026-10"); // consumos de 06/09 a 05/10
  });

  it("Mercado Pago: compra depois do fechamento vai para a fatura seguinte", () => {
    expect(fatura("2026-10-06", mercadoPago)).toBe("2026-11");
  });

  it("Sicredi: fecha dia 28 e vence dia 13 do mês seguinte", () => {
    expect(fatura("2026-09-28", sicredi)).toBe("2026-10");
    expect(fatura("2026-09-29", sicredi)).toBe("2026-11"); // melhor dia de compra 29
  });

  it("Nubank: fecha dia 20 e vence dia 27 do mesmo mês", () => {
    expect(fatura("2026-10-20", nubank)).toBe("2026-10");
    expect(fatura("2026-10-21", nubank)).toBe("2026-11");
  });

  it("vira o ano", () => {
    expect(fatura("2026-12-29", sicredi)).toBe("2027-02");
    expect(fatura("2026-12-10", mercadoPago)).toBe("2027-01");
  });

  it("fechamento no dia 31 funciona em fevereiro", () => {
    const c = { dia_fechamento: 31, dia_vencimento: 10 };
    expect(fatura("2027-02-28", c)).toBe("2027-03");
    expect(fatura("2027-03-01", c)).toBe("2027-04");
  });
});

describe("parcelas", () => {
  it("divide em centavos sem perder nada", () => {
    const p = dividirParcelas(100, 3);
    expect(p).toEqual([33.34, 33.33, 33.33]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });

  it("cada parcela cai em uma fatura seguida", () => {
    const p = parcelasDaCompra("2026-10-29", 300, 3, sicredi);
    expect(p.map((x) => chaveMes(x.fatura))).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(p.map((x) => x.valor)).toEqual([100, 100, 100]);
  });
});
