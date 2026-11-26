import { describe, expect, it } from "vitest";
import { acharRepetido, descricoesParecidas, quandoFoi, textoRepetido } from "../src/lib/repetido";
import { ehNao, ehSim, recadosDoPacote } from "../src/lib/whatsapp";

// 26/11/2026 às 14h em Cuiabá (UTC-4)
const agora = new Date("2026-11-26T18:00:00Z");
const pizza = {
  id: "a",
  tipo: "saida" as const,
  valor: 40,
  data: "2026-11-26",
  descricao: "Pizza escola",
  criado_por: "jo",
  criado_em: "2026-11-26T14:00:00Z", // 10h em Cuiabá
};

describe("lançamento repetido", () => {
  it("acha o mesmo valor com descrição parecida", () => {
    const novo = { tipo: "saida" as const, valor: 40, data: "2026-11-26", descricao: "pizza na escola" };
    expect(acharRepetido(novo, [pizza], agora)?.id).toBe("a");
  });

  it("não avisa com valor, descrição ou tipo diferentes", () => {
    const base = { tipo: "saida" as const, valor: 40, data: "2026-11-26", descricao: "Pizza escola" };
    expect(acharRepetido({ ...base, valor: 41 }, [pizza], agora)).toBeNull();
    expect(acharRepetido({ ...base, descricao: "Mercado" }, [pizza], agora)).toBeNull();
    expect(acharRepetido({ ...base, tipo: "entrada" }, [pizza], agora)).toBeNull();
  });

  it("não avisa sobre lançamento antigo nem sobre ele mesmo", () => {
    const novo = { tipo: "saida" as const, valor: 40, data: "2026-11-26", descricao: "Pizza" };
    expect(acharRepetido(novo, [{ ...pizza, criado_em: "2026-11-20T14:00:00Z" }], agora)).toBeNull();
    expect(acharRepetido({ ...novo, id: "a" }, [pizza], agora)).toBeNull();
  });

  it("compara descrições sem acento e por começo de palavra", () => {
    expect(descricoesParecidas("Padaria Pão Quente", "padaria")).toBe(true);
    expect(descricoesParecidas("Farmácia", "farmacias pague menos")).toBe(true);
    expect(descricoesParecidas("Gasolina", "Mercado")).toBe(false);
    expect(descricoesParecidas(null, "Mercado")).toBe(true);
  });

  it("monta a pergunta com quem e quando", () => {
    expect(textoRepetido(pizza, "Jô", agora).replace(/\s/g, " ")).toBe("Jô já lançou Pizza escola R$ 40,00 hoje às 10h. Lançar mesmo assim?");
    expect(quandoFoi("2026-11-25T22:30:00Z", agora)).toBe("ontem às 18h30");
    expect(quandoFoi("2026-11-23T13:00:00Z", agora)).toBe("23/11 às 9h");
  });
});

describe("whatsapp: resposta Sim/Não", () => {
  it("entende sim e não digitados", () => {
    expect(ehSim("Sim")).toBe(true);
    expect(ehSim("pode lançar")).toBe(true);
    expect(ehNao("Não")).toBe(true);
    expect(ehSim("simone 50 pix")).toBe(false);
    expect(ehNao("nao sei quanto gastei no mercado ontem")).toBe(false);
  });

  it("lê o toque no botão", () => {
    const pacote = {
      entry: [{ changes: [{ value: { messages: [{ id: "w1", from: "55659", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "sim", title: "Sim, lançar" } } }] } }] }],
    };
    expect(recadosDoPacote(pacote)).toEqual([{ id: "w1", de: "55659", tipo: "botao", resposta: "sim" }]);
  });
});
