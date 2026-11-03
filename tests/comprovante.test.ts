import { describe, expect, it } from "vitest";
import { combinar, doEndereco, normalizar, paraEndereco, tipoDoArquivo } from "../src/lib/comprovante";

describe("comprovante", () => {
  it("arruma o que a IA devolve", () => {
    const l = normalizar({ tipo: "saida", valor: "59.456", data: "2026-11-03", descricao: " Comper ", forma: "credito", parcelas: 0, final_cartao: "****7557" });
    expect(l).toMatchObject({ valor: 59.46, descricao: "Comper", parcelas: 1, final_cartao: "7557" });
    expect(normalizar({ tipo: "x", forma: "credito", parcelas: 3, data: "03/11" })).toMatchObject({ tipo: "saida", parcelas: 3, data: null });
    expect(normalizar({ tipo: "entrada", forma: "credito" }).forma).toBe("pix");
  });

  it("vai e volta pelo endereço do Atalho", () => {
    const l = normalizar({ tipo: "saida", valor: 110, data: "2026-11-03", descricao: "Pix para Elio", forma: "pix", instituicao: "Sicredi" });
    const p = new URL("https://x" + paraEndereco(l)).searchParams;
    expect(doEndereco(p)).toEqual(l);
    expect(doEndereco(new URLSearchParams("valor=3"))).toBeNull();
  });

  it("acha a conta pelo nome do banco", () => {
    const contas = [{ nome: "Mercado Pago" }, { nome: "Sicredi" }, { nome: "Nubank" }];
    expect(combinar(contas, "BANCO COOPERATIVO SICREDI S.A.")?.nome).toBe("Sicredi");
    expect(combinar(contas, "NU PAGAMENTOS - IP")?.nome).toBe("Nubank");
    expect(combinar(contas, "Banco XP")).toBeUndefined();
    expect(combinar(contas, "mercado pago")?.nome).toBe("Mercado Pago");
  });

  it("reconhece o tipo do arquivo", () => {
    const b = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
    expect(tipoDoArquivo(b("%PDF-1.4"))).toBe("application/pdf");
    expect(tipoDoArquivo(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(tipoDoArquivo(b("\0\0\0\x18ftypheic"))).toBe("image/heic");
  });
});
