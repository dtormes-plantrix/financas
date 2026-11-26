import { describe, expect, it } from "vitest";
import { calendario, contasDoCalendario, faixaDe } from "../src/lib/calendario";
import type { Cartao, Compromisso, Lancamento, Negocio } from "../src/lib/tipos";

const mp: Cartao = {
  id: "mp", nome: "Mercado Pago", dono: "diego", limite: 16000, dia_fechamento: 5, dia_vencimento: 13,
  conta_pagamento_id: null, limite_usado: null, limite_atualizado_em: null, ativo: true,
};

let n = 0;
const lanc = (p: Partial<Lancamento>): Lancamento => ({
  id: String(++n), tipo: "saida", valor: 0, data: "2026-11-10", descricao: null, forma: "pix",
  conta_id: "mp", cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null,
  de_quem: "casa", criado_por: null, criado_em: "", ...p,
});

const credito: Compromisso = {
  id: "cred", nome: "Crédito contratado", valor: 1014.22, dia_vencimento: 18, mes_inicial: "2026-11",
  parcela_inicial: 7, total_parcelas: 18, valor_total: null, conta_id: null, ativo: true,
};
const joao: Compromisso = {
  id: "joao", nome: "Devolver poupança do João", valor: 500, dia_vencimento: null, mes_inicial: "2026-11",
  parcela_inicial: 1, total_parcelas: null, valor_total: 8500, conta_id: null, ativo: true,
};
const studio: Negocio = { id: "studio", nome: "Studio Pilates", fonte_id: null, ativo: true };

const base = {
  lancamentos: [] as Lancamento[],
  lancamentosNegocios: [] as Lancamento[],
  cartoes: [mp],
  fontes: [],
  faturasInformadas: [],
  compromissos: [credito, joao],
  negocios: [studio],
};

describe("calendário de contas", () => {
  it("separa por prazo", () => {
    const hoje = "2026-11-26";
    expect(faixaDe("2026-11-13", hoje)).toBe("vencidas");
    expect(faixaDe("2026-11-26", hoje)).toBe("hoje");
    expect(faixaDe("2026-12-03", hoje)).toBe("semana");
    expect(faixaDe("2026-12-04", hoje)).toBe("mes");
    expect(faixaDe("2026-12-26", hoje)).toBe("mes");
    expect(faixaDe("2026-12-27", hoje)).toBeNull();
    expect(faixaDe("2026-10-26", hoje)).toBeNull();
  });

  it("mostra fatura, parcelas e conta sem dia no fim do mês", () => {
    const dados = { ...base, lancamentos: [lanc({ valor: 300, data: "2026-11-02", forma: "credito", cartao_id: "mp", conta_id: null })] };
    const cal = calendario(dados, "2026-11-26");
    expect(cal.vencidas.map((c) => c.nome)).toEqual(["Fatura Mercado Pago", "Crédito contratado"]);
    expect(cal.vencidas[0].valor).toBe(300);
    expect(cal.semana.map((c) => [c.nome, c.vence, c.semDia])).toEqual([["Devolver poupança do João", "2026-11-30", true]]);
    // a do João de dezembro vence dia 31, a mais de 30 dias
    expect(cal.mes.map((c) => c.nome)).toEqual(["Crédito contratado"]);
  });

  it("fatura marcada como paga sai da lista e vai para pagas", () => {
    const dados = {
      ...base,
      compromissos: [],
      lancamentos: [lanc({ valor: 300, data: "2026-11-02", forma: "credito", cartao_id: "mp", conta_id: null })],
      faturasInformadas: [{ id: "f", cartao_id: "mp", mes: "2026-11", valor: 300, paga_em: "2026-11-13" }],
    };
    const cal = calendario(dados, "2026-11-26");
    expect(cal.vencidas).toEqual([]);
    expect(cal.pagas.map((c) => c.nome)).toEqual(["Fatura Mercado Pago"]);
  });

  it("parcela paga pelo botão sai das pendentes", () => {
    const dados = { ...base, compromissos: [credito], lancamentos: [lanc({ valor: 1014.22, data: "2026-11-18", compromisso_id: "cred" })] };
    const cal = calendario(dados, "2026-11-26");
    expect(cal.vencidas).toEqual([]);
    expect(cal.pagas.map((c) => c.nome)).toEqual(["Crédito contratado"]);
  });

  it("despesa fixa do Studio se repete no mesmo dia até ser lançada", () => {
    const aluguel = (data: string) => lanc({ valor: 900, data, descricao: "Aluguel da sala", negocio_id: "studio", grupo: "fixa" });
    const dados = { ...base, compromissos: [], lancamentosNegocios: [aluguel("2026-10-05")] };
    const pend = contasDoCalendario(dados, "2026-11-26").filter((c) => !c.paga);
    expect(pend.map((c) => [c.vence, c.valor, c.detalhe])).toEqual([
      ["2026-11-05", 900, "Studio Pilates"],
      ["2026-12-05", 900, "Studio Pilates"],
    ]);
    // lançada em novembro: novembro fica pago e dezembro continua previsto
    const depois = contasDoCalendario({ ...dados, lancamentosNegocios: [aluguel("2026-10-05"), aluguel("2026-11-06")] }, "2026-11-26");
    expect(depois.filter((c) => c.mes.mes === 11).map((c) => c.paga)).toEqual([true]);
    expect(depois.filter((c) => c.mes.mes === 12).map((c) => [c.paga, c.vence])).toEqual([[false, "2026-12-06"]]);
  });
});
