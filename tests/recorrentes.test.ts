import { describe, expect, it } from "vitest";
import { resumoDoMes } from "../src/lib/painel";
import { chaveDoExtrato, sugerirRecorrentes } from "../src/lib/recorrentes";
import type { Cartao, Compromisso, Lancamento } from "../src/lib/tipos";

const nubank: Cartao = {
  id: "nu", nome: "Nubank", dono: "jo", limite: 48300, dia_fechamento: 20, dia_vencimento: 27,
  conta_pagamento_id: null, limite_usado: null, limite_atualizado_em: null, ativo: true,
};

let n = 0;
const lanc = (p: Partial<Lancamento>): Lancamento => ({
  id: String(++n), tipo: "saida", valor: 0, data: "2026-10-10", descricao: null, forma: "pix",
  conta_id: "sicredi", cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null,
  de_quem: "jo", criado_por: null, criado_em: "", ...p,
});

const fixa = (p: Partial<Compromisso>): Compromisso => ({
  id: "c" + ++n, nome: "x", valor: 0, dia_vencimento: 15, mes_inicial: "2026-11", parcela_inicial: 1,
  total_parcelas: null, valor_total: null, conta_id: null, cartao_id: null, busca: null, ativo: true, ...p,
});

describe("contas que se repetem", () => {
  it("limpa o texto do extrato", () => {
    expect(chaveDoExtrato("Netflix.com 21/09")).toBe("NETFLIX COM");
    expect(chaveDoExtrato("Condomí 10/2026")).toBe("CONDOMI");
    expect(chaveDoExtrato("DL*Starlink Braz")).toBe("STARLINK BRAZ");
    expect(chaveDoExtrato("X122")).toBe("X");
  });

  it("sugere o que aparece em dois meses com valor parecido e ignora o mercado", () => {
    const l = [
      lanc({ descricao: "Condomi", valor: 1297.26, data: "2026-09-15", forma: "debito" }),
      lanc({ descricao: "Condomi", valor: 1297.26, data: "2026-10-15", forma: "debito" }),
      lanc({ descricao: "Netflix Com", valor: 59.9, data: "2026-09-21", forma: "credito", cartao_id: "nu" }),
      lanc({ descricao: "Netflix Com", valor: 59.9, data: "2026-10-21", forma: "credito", cartao_id: "nu" }),
      ...[1, 3, 5, 7].flatMap((d) => [
        lanc({ descricao: "Comper", valor: 80, data: `2026-09-0${d}`, forma: "credito", cartao_id: "nu" }),
        lanc({ descricao: "Comper", valor: 80, data: `2026-10-0${d}`, forma: "credito", cartao_id: "nu" }),
      ]),
      lanc({ descricao: "Psg Academy", valor: 500, data: "2026-09-16" }),
      lanc({ descricao: "Psg Academy", valor: 90, data: "2026-10-20" }),
    ];
    const s = sugerirRecorrentes(l, [], "2026-11-03");
    expect(s.map((x) => x.chave)).toEqual(["CONDOMI", "NETFLIX COM"]);
    expect(s[1]).toMatchObject({ valor: 59.9, dia: 21, cartao_id: "nu" });
    // depois de confirmada (ou recusada), some das sugestões
    expect(sugerirRecorrentes(l, [fixa({ busca: "CONDOMI", ativo: false })], "2026-11-03")).toHaveLength(1);
  });

  it("soma no mês seguinte e não conta de novo quando o extrato já trouxe", () => {
    const condominio = fixa({ nome: "Condomínio", valor: 1297.26, busca: "CONDOMI" });
    const netflix = fixa({ nome: "Netflix", valor: 59.9, dia_vencimento: 21, cartao_id: "nu", busca: "NETFLIX COM" });
    const base = { lancamentos: [] as Lancamento[], cartoes: [nubank], fontes: [], faturasInformadas: [], compromissos: [condominio, netflix], hoje: "2026-11-03" };

    const dez = resumoDoMes({ ano: 2026, mes: 12 }, base);
    expect(dez.parcelas).toBe(1297.26);
    // compra no dia 21 fecha no dia 20: vai para a fatura de dezembro (vence 27/12)
    expect(dez.faturas).toBe(59.9);

    const pago = lanc({ descricao: "Condomi 11/2026", valor: 1297.26, data: "2026-11-15", forma: "debito" });
    const nov = resumoDoMes({ ano: 2026, mes: 11 }, { ...base, lancamentos: [pago] });
    expect(nov.parcelas).toBe(0);

    const veio = lanc({ descricao: "Netflix.com", valor: 59.9, data: "2026-11-21", forma: "credito", cartao_id: "nu" });
    expect(resumoDoMes({ ano: 2026, mes: 12 }, { ...base, lancamentos: [veio] }).faturas).toBe(59.9);
  });
});
