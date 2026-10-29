const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function reais(v: number): string {
  return moeda.format(v);
}

/** "1.234,56" ou "1234,5" ou "1234.56" -> 1234.56 */
export function lerValor(texto: string): number {
  const limpo = texto.replace(/[^\d,.-]/g, "");
  if (!limpo) return 0;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const v = Number(normalizado);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

/** Data de hoje no fuso do aparelho, em AAAA-MM-DD. */
export function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export const NOME_FORMA = { pix: "Pix", debito: "Débito", dinheiro: "Dinheiro", credito: "Crédito" } as const;
export const NOME_DONO = { diego: "Diego", jo: "Jô", casa: "Casa" } as const;
