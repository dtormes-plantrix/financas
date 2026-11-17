import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizar } from "../src/lib/comprovante";
import { assinaturaValida, ehDesfazer, lerPessoas, montarLancamento, quemEnviou, recadosDoPacote, textoConfirmacao } from "../src/lib/whatsapp";
import type { Cartao, Categoria, Conta } from "../src/lib/tipos";

const conta = (id: string, nome: string, dono: "diego" | "jo"): Conta =>
  ({ id, nome, dono, ativo: true, limite_cheque_especial: null, saldo: null, saldo_atualizado_em: null });
const cartao = (id: string, nome: string, dono: "diego" | "jo"): Cartao =>
  ({ id, nome, dono, ativo: true, limite: null, dia_fechamento: 5, dia_vencimento: 13, conta_pagamento_id: null, limite_usado: null, limite_atualizado_em: null });
const cad = {
  contas: [conta("c1", "Mercado Pago", "diego"), conta("c2", "Sicredi", "jo")],
  cartoes: [cartao("k1", "Mercado Pago", "diego"), cartao("k2", "Nubank", "jo")],
  categoriasDaCasa: [{ id: "m", nome: "Mercado" }, { id: "b", nome: "Bares e restaurantes" }] as Categoria[],
  regras: [],
  lancamentos: [],
};
const extra = { hoje: "2026-11-17", whatsappId: "wamid.1", criadoPor: "u1" };

describe("whatsapp", () => {
  it("confere a assinatura da Meta", () => {
    const corpo = '{"a":1}';
    const ass = "sha256=" + createHmac("sha256", "segredo").update(corpo).digest("hex");
    expect(assinaturaValida(corpo, ass, "segredo")).toBe(true);
    expect(assinaturaValida(corpo + " ", ass, "segredo")).toBe(false);
    expect(assinaturaValida(corpo, null, "segredo")).toBe(false);
  });

  it("reconhece o número com ou sem o 9", () => {
    const p = lerPessoas("5565999990000:diego, +55 65 98888-0000:Jo");
    expect(quemEnviou("556599990000", p)).toBe("diego");
    expect(quemEnviou("5565988880000", p)).toBe("jo");
    expect(quemEnviou("5511912345678", p)).toBeNull();
  });

  it("tira os recados do pacote", () => {
    const pacote = { entry: [{ changes: [{ value: { messages: [
      { id: "a", from: "1", type: "text", text: { body: "mercado 85" } },
      { id: "b", from: "1", type: "image", image: { id: "m1", caption: "" } },
      { id: "c", from: "1", type: "sticker" },
    ], statuses: [{}] } }] }] };
    expect(recadosDoPacote(pacote).map((r) => r.tipo)).toEqual(["texto", "arquivo", "outro"]);
    expect(recadosDoPacote({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([]);
  });

  it("monta a compra no cartão certo, com categoria", () => {
    const l = normalizar({ tipo: "saida", valor: 85, data: null, descricao: "Mercado", forma: "credito", parcelas: 1, instituicao: "Nubank", categoria: "mercado" });
    const r = montarLancamento(l, "diego", cad, extra);
    expect(r).toMatchObject({ cartao_id: "k2", conta_id: null, categoria_id: "m", data: "2026-11-17", whatsapp_id: "wamid.1", criado_por: "u1" });
    expect(textoConfirmacao(r, cad, extra.hoje)).toContain("cartão Nubank");
  });

  it("sem banco dito, usa a conta de quem mandou", () => {
    const l = normalizar({ tipo: "saida", valor: 30, descricao: "sorvete", forma: "pix" });
    expect(montarLancamento(l, "jo", cad, extra).conta_id).toBe("c2");
    const t = normalizar({ tipo: "transferencia", valor: 500, forma: "pix", instituicao: "Mercado Pago", instituicao_destino: "Sicredi" });
    expect(montarLancamento(t, "diego", cad, extra)).toMatchObject({ conta_id: "c1", conta_destino_id: "c2", categoria_id: null });
  });

  it("entende o desfaz", () => {
    expect(ehDesfazer("Desfaz")).toBe(true);
    expect(ehDesfazer("mercado 85")).toBe(false);
  });
});
