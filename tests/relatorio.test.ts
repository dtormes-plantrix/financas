import { describe, expect, it } from "vitest";
import type { Dados } from "../src/lib/dados";
import {
  avisosDeOrcamento, camposDoAviso, camposDoModelo, relatorioDoDia, textoAviso, textoFechamento, textoSemanal,
} from "../src/lib/relatorio";
import { pedidoDeRelatorio, recadosDoPacote } from "../src/lib/whatsapp";
import { janelaAberta } from "../src/lib/whatsapp-envio";
import type { Cartao, Lancamento } from "../src/lib/tipos";

const base: Lancamento = {
  id: "x", tipo: "saida", valor: 0, data: "2026-11-01", descricao: null, forma: "pix", conta_id: null, cartao_id: null,
  parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "casa", criado_por: null, criado_em: "",
};
const l = (o: Partial<Lancamento>): Lancamento => ({ ...base, id: Math.random().toString(), ...o });
const nubank: Cartao = {
  id: "k", nome: "Nubank", dono: "jo", limite: null, dia_fechamento: 20, dia_vencimento: 27,
  conta_pagamento_id: null, limite_usado: null, limite_atualizado_em: null, ativo: true,
};

const dados = (lancamentos: Lancamento[]): Dados => ({
  membros: [], contas: [], cartoes: [nubank], fontes: [], grupos: [], regras: [], faturasInformadas: [], compromissos: [],
  negocios: [], lancamentosNegocios: [],
  categorias: [{ id: "m", nome: "Mercado", orcamento: 2000 }, { id: "d", nome: "Delivery", orcamento: 300 }],
  lancamentos,
});

describe("quando enviar", () => {
  it("dia 1 é fechamento, segunda é resumo, o resto nada", () => {
    expect(relatorioDoDia("2026-12-01")).toBe("fechamento"); // terça
    expect(relatorioDoDia("2026-11-30")).toBe("semanal"); // segunda
    expect(relatorioDoDia("2026-11-26")).toBeNull(); // quinta
  });
});

describe("textos", () => {
  const d = dados([
    l({ valor: 1900, data: "2026-11-20", categoria_id: "m" }),
    l({ valor: 100, data: "2026-11-25", categoria_id: "d", forma: "credito", cartao_id: "k" }),
    l({ tipo: "entrada", valor: 5000, data: "2026-11-05" }),
    l({ valor: 1000, data: "2026-10-10", categoria_id: "m" }),
  ]);

  it("resumo da semana traz gastos, orçamento, contas e previsão", () => {
    const t = textoSemanal(d, "2026-11-30");
    expect(t).toContain("Resumo da semana* (23/11 a 29/11)");
    expect(t).toContain("Gastos: R$\u00a0100,00 em 1 lançamento");
    expect(t).toContain("🟢 Mercado: R$\u00a01.900,00 de R$\u00a02.000,00 (95%)");
    expect(t).toContain("*Previsão*");
    expect(t).toContain("Dezembro: vai");
  });

  it("fechamento compara com o mês anterior", () => {
    const t = textoFechamento(d, "2026-12-01");
    expect(t).toContain("Fechamento de novembro de 2026");
    expect(t).toContain("Entrou: R$\u00a05.000,00");
    expect(t).toContain("Gastos (com cartão): R$\u00a02.000,00 (+100% em relação a outubro)");
    expect(t).toContain("• Mercado: R$\u00a01.900,00");
  });

  it("campos do modelo não têm quebra de linha", () => {
    const c = camposDoModelo("semanal", d, "2026-11-30");
    expect(c[0]).toBe("resumo da semana");
    expect(c[1]).toBe("dezembro");
    expect(c.every((x) => !x.includes("\n"))).toBe(true);
  });
});

describe("aviso de orçamento", () => {
  it("avisa 90% e 100% uma vez por mês", () => {
    const d = dados([l({ valor: 1850, data: "2026-11-20", categoria_id: "m" }), l({ valor: 350, data: "2026-11-21", categoria_id: "d" })]);
    const avisos = avisosDeOrcamento(d, "2026-11-26", new Set());
    expect(avisos.map((a) => a.chave).sort()).toEqual(["orcamento:2026-11:d:100", "orcamento:2026-11:m:90"]);
    expect(avisosDeOrcamento(d, "2026-11-27", new Set(["orcamento:2026-11:m:90", "orcamento:2026-11:d:100"]))).toEqual([]);
    const mercado = avisos.find((a) => a.item.categoria.id === "m")!;
    expect(textoAviso(mercado)).toContain("Mercado* já usou 93% do orçamento");
    expect(camposDoAviso(mercado)).toEqual(["Mercado", "93%", "R$\u00a01.850,00", "R$\u00a02.000,00"]);
  });
});

describe("pedido de relatório no WhatsApp", () => {
  it("entende o texto e o botão do modelo", () => {
    expect(pedidoDeRelatorio("Relatório")).toBe("semanal");
    expect(pedidoDeRelatorio("resumo!")).toBe("semanal");
    expect(pedidoDeRelatorio("fechamento")).toBe("fechamento");
    expect(pedidoDeRelatorio("resumo do mercado 50")).toBeNull();
    const pacote = { entry: [{ changes: [{ value: { messages: [
      { id: "a", from: "1", type: "button", button: { text: "Ver relatório", payload: "relatorio:fechamento" } },
      { id: "b", from: "1", type: "text", text: { body: "resumo" } },
      { id: "c", from: "1", type: "text", text: { body: "mercado 85" } },
    ] } }] }] };
    expect(recadosDoPacote(pacote)).toEqual([
      { id: "a", de: "1", tipo: "relatorio", qual: "fechamento" },
      { id: "b", de: "1", tipo: "relatorio", qual: "semanal" },
      { id: "c", de: "1", tipo: "texto", texto: "mercado 85" },
    ]);
  });

  it("janela de 24h", () => {
    const agora = Date.parse("2026-11-26T12:00:00Z");
    expect(janelaAberta("2026-11-26T01:00:00Z", agora)).toBe(true);
    expect(janelaAberta("2026-11-25T12:00:00Z", agora)).toBe(false);
    expect(janelaAberta(null, agora)).toBe(false);
  });
});
