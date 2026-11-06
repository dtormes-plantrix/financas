import { describe, expect, it } from "vitest";
import { chavePagador, previsaoEntradas } from "../src/lib/negocios";
import type { Lancamento, Negocio } from "../src/lib/tipos";

const studio: Negocio = { id: "s", nome: "Studio Pilates", fonte_id: null, ativo: true };
const l = (data: string, valor: number, descricao: string, grupo: Lancamento["grupo"] = "aluno", tipo: Lancamento["tipo"] = "entrada"): Lancamento => ({
  id: `${data}-${descricao}`, tipo, valor, data, descricao, forma: "pix", conta_id: null, cartao_id: null, parcelas: 1,
  fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: null, criado_em: "", negocio_id: "s", grupo,
});

describe("previsão de entradas do negócio", () => {
  it("acha a mesma pessoa com descrições diferentes", () => {
    expect(chavePagador("Mensalidade Ana")).toBe(chavePagador("ana"));
    expect(chavePagador("Pix da Bárbara")).toBe("barbara");
  });

  it("quem pagou mês passado e não pagou ainda entra como previsto", () => {
    const ls = [
      l("2026-10-05", 350, "Mensalidade Ana"),
      l("2026-10-06", 400, "Mensalidade Bia"),
      l("2026-10-07", 200, "Aula avulsa", "outra"),
      l("2026-11-03", 350, "Ana"),
      l("2026-11-04", 300, "Mensalidade Carla"),
      l("2026-11-04", 900, "Aluguel da sala", "fixa", "saida"),
    ];
    const p = previsaoEntradas(studio, { ano: 2026, mes: 11 }, ls);
    expect(p.jaEntrou).toBe(650);
    expect(p.faltam).toEqual([{ nome: "Mensalidade Bia", valor: 400 }]);
    expect(p.previsto).toBe(1050);
    expect(p.previstoSeguinte).toBe(1050); // Ana, Carla e Bia; a aula avulsa não se repete
    expect(p.fixas).toBe(900);
  });
});
