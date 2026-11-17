import { describe, expect, it } from "vitest";
import { marcacaoPorPalavra, resumoMarcacao } from "../src/lib/negocios";
import { gastosPorCategoria } from "../src/lib/orcamento";
import type { Categoria, FonteRenda, Lancamento, Negocio } from "../src/lib/tipos";

const plantrix: Negocio = {
  id: "p", nome: "Plantrix", fonte_id: "f", ativo: true, so_marcacao: true,
  palavras_marcacao: ["google", "adobe", "magnific", "anthropic", "contabilivre"],
};
const fonte: FonteRenda = {
  id: "f", nome: "Plantrix", valor_bruto: 9000, percentual_imposto: 6, descontos_fixos: 277.2, dia_previsto: null, conta_id: null, ativo: true,
};
const l = (data: string, valor: number, descricao: string, extra: Partial<Lancamento> = {}): Lancamento => ({
  id: `${data}-${descricao}`, tipo: "saida", valor, data, descricao, forma: "credito", conta_id: null, cartao_id: "k", parcelas: 1,
  fonte_id: null, categoria_id: null, de_quem: "diego", criado_por: null, criado_em: "", ...extra,
});

describe("Plantrix (negócio só de marcação)", () => {
  it("marca pelas contas da empresa, mas não o YouTube", () => {
    expect(marcacaoPorPalavra("Ebn Adobe", [plantrix])?.id).toBe("p");
    expect(marcacaoPorPalavra("Compra internacional em ANTHROPIC* CLAUDE SUB", [plantrix])?.id).toBe("p");
    expect(marcacaoPorPalavra("DL*GOOGLE YouTub", [plantrix])).toBeUndefined();
    expect(marcacaoPorPalavra("Comper", [plantrix])).toBeUndefined();
  });

  it("resultado = o que entrou − gastos marcados; descontos separados", () => {
    const ls = [
      l("2026-11-05", 8182.8, "Plantrix", { tipo: "entrada", fonte_id: "f", forma: "pix", cartao_id: null }),
      l("2026-11-01", 189, "Ebn Adobe", { marcado_negocio_id: "p" }),
      l("2026-11-04", 113.85, "Anthropic", { marcado_negocio_id: "p" }),
      l("2026-11-04", 300, "Comper"),
    ];
    const r = resumoMarcacao(plantrix, fonte, { ano: 2026, mes: 11 }, ls, "2026-11-17");
    expect(r.impostoNotas).toBe(540);
    expect(r.descontos).toBe(277.2);
    expect(r.liquidoPrevisto).toBe(8182.8);
    expect(r.previsto).toBe(false);
    expect(r.gastos).toBe(302.85);
    expect(r.resultado).toBe(7879.95);
  });

  it("mês atual sem entrada usa o líquido previsto; mês passado sem entrada não", () => {
    expect(resumoMarcacao(plantrix, fonte, { ano: 2026, mes: 11 }, [], "2026-11-17")).toMatchObject({ previsto: true, receita: 8182.8 });
    expect(resumoMarcacao(plantrix, fonte, { ano: 2026, mes: 9 }, [], "2026-11-17")).toMatchObject({ previsto: false, receita: 0 });
  });

  it("gasto marcado não entra no orçamento da casa", () => {
    const cat: Categoria = { id: "c", nome: "Ferramentas", orcamento: 100 };
    const ls = [l("2026-11-01", 189, "Adobe", { categoria_id: "c", marcado_negocio_id: "p" }), l("2026-11-02", 30, "Outro", { categoria_id: "c" })];
    const [item] = gastosPorCategoria([cat], ls, [], { ano: 2026, mes: 11 }, "2026-11-17");
    expect(item.gasto).toBe(30);
  });
});
