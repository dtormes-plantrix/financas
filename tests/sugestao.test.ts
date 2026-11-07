import { describe, expect, it } from "vitest";
import { descricaoAmbigua, sugerirCategorias } from "../src/lib/sugestao";
import type { Categoria, Lancamento, RegraCategoria } from "../src/lib/tipos";

const base: Lancamento = {
  id: "x", tipo: "saida", valor: 10, data: "2026-11-01", descricao: null, forma: "pix", conta_id: null, cartao_id: null,
  parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "casa", criado_por: null, criado_em: "",
};
const l = (o: Partial<Lancamento>): Lancamento => ({ ...base, id: Math.random().toString(), ...o });

const cats: Categoria[] = [
  { id: "m", nome: "Mercado" }, { id: "b", nome: "Bares e restaurantes" }, { id: "d", nome: "Delivery" },
  { id: "c", nome: "Combustível" },
] as Categoria[];
const regras: RegraCategoria[] = [{ id: "1", busca: "lanche", categoria_id: "b" }, { id: "2", busca: "comper", categoria_id: "m" }];

describe("sugerirCategorias", () => {
  it("água sugere Bares primeiro", () => {
    expect(sugerirCategorias("Água", cats, regras, [])[0]).toBe("b");
  });
  it("lanche dá Bares e Delivery", () => {
    expect(sugerirCategorias("lanche", cats, regras, [])).toEqual(["b", "d"]);
  });
  it("sugere enquanto digita", () => {
    expect(sugerirCategorias("gasol", cats, regras, [])).toEqual(["c"]);
  });
  it("aprende com as escolhas", () => {
    const hist = [1, 2, 3].map(() => l({ descricao: "lanche", categoria_id: "d" }));
    expect(sugerirCategorias("lanche escola", cats, regras, hist)[0]).toBe("d");
  });
  it("loja conhecida", () => {
    expect(sugerirCategorias("Comper MT", cats, regras, [])).toEqual(["m"]);
  });
  it("vazio não sugere", () => {
    expect(sugerirCategorias("", cats, regras, [])).toEqual([]);
  });
});

describe("descricaoAmbigua", () => {
  it("lanche é ambígua, comper não", () => {
    expect(descricaoAmbigua("Lanches")).toBe(true);
    expect(descricaoAmbigua("Comper")).toBe(false);
    expect(descricaoAmbigua("gasolina")).toBe(false);
  });
});
