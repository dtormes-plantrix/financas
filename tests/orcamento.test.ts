import { describe, expect, it } from "vitest";
import { buscaDaDescricao, categoriaDe, faltaGastar, gastosPorCategoria, ritmoDoMes, situacao } from "../src/lib/orcamento";
import type { Categoria, Lancamento, RegraCategoria } from "../src/lib/tipos";

const base: Lancamento = {
  id: "x", tipo: "saida", valor: 0, data: "2026-11-01", descricao: null, forma: "credito", conta_id: null, cartao_id: null,
  parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "casa", criado_por: null, criado_em: "",
};
const l = (o: Partial<Lancamento>): Lancamento => ({ ...base, id: Math.random().toString(), ...o });

const mercado: Categoria = { id: "m", nome: "Mercado", orcamento: 2000 };
const bares: Categoria = { id: "b", nome: "Bares e restaurantes", orcamento: 500 };
const delivery: Categoria = { id: "d", nome: "Delivery", orcamento: 300 };
const regras: RegraCategoria[] = [
  { id: "1", busca: "comper", categoria_id: "m" },
  { id: "2", busca: "ifood", categoria_id: "d" },
  { id: "3", busca: "pizz", categoria_id: "b" },
  { id: "4", busca: "ifood pizz", categoria_id: "b" },
];

describe("categoria pelo nome da loja", () => {
  it("usa a regra quando não tem categoria, sem ligar para acento e maiúscula", () => {
    expect(categoriaDe(l({ descricao: "COMPER MT" }), regras)).toBe("m");
    expect(categoriaDe(l({ descricao: "Pizzária do Zé" }), regras)).toBe("b");
  });
  it("a regra de texto mais longo vence", () => {
    expect(categoriaDe(l({ descricao: "iFood Pizzaria" }), regras)).toBe("b");
  });
  it("a categoria escolhida vale mais que a regra", () => {
    expect(categoriaDe(l({ descricao: "Comper", categoria_id: "b" }), regras)).toBe("b");
  });
  it("entrada não ganha categoria por regra", () => {
    expect(categoriaDe(l({ descricao: "Comper", tipo: "entrada" }), regras)).toBeNull();
  });
  it("texto da regra tira números e asteriscos", () => {
    expect(buscaDaDescricao("PG *Supermercado SCS 0123")).toBe("pg supermercado scs");
  });
});

describe("orçamento do mês", () => {
  it("ritmo: metade do mês no dia 15 de novembro", () => {
    expect(ritmoDoMes({ ano: 2026, mes: 11 }, "2026-11-15")).toBe(0.5);
    expect(ritmoDoMes({ ano: 2026, mes: 12 }, "2026-11-15")).toBe(0);
    expect(ritmoDoMes({ ano: 2026, mes: 10 }, "2026-11-15")).toBe(1);
  });
  it("verde no ritmo, amarelo acima do ritmo, vermelho estourado", () => {
    expect(situacao(900, 2000, 1000)).toBe("ok");
    expect(situacao(1300, 2000, 1000)).toBe("acima");
    expect(situacao(2100, 2000, 1000)).toBe("estourou");
  });
  it("soma os gastos do mês por categoria e o que falta gastar", () => {
    const ls = [
      l({ valor: 500, descricao: "Comper", data: "2026-11-03" }),
      l({ valor: 300, descricao: "Comper", data: "2026-10-30" }), // outro mês
      l({ valor: 80, descricao: "iFood", data: "2026-11-04" }),
      l({ valor: 400, descricao: "iFood", data: "2026-11-05" }),
      l({ valor: 1000, descricao: "Comper", data: "2026-11-05", tipo: "transferencia" }),
    ];
    const itens = gastosPorCategoria([mercado, bares, delivery], ls, regras, { ano: 2026, mes: 11 }, "2026-11-06", true);
    const de = (id: string) => itens.find((i) => i.categoria.id === id)!;
    expect(de("m").gasto).toBe(500);
    expect(de("d").gasto).toBe(480);
    expect(de("d").situacao).toBe("estourou");
    expect(de("b").gasto).toBe(0);
    // falta: mercado 1500 + bares 500 + delivery 0 (estourou não conta negativo)
    expect(faltaGastar(itens)).toBe(2000);
  });
});
