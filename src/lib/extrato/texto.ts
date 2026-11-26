// Monta o texto de um PDF linha por linha, a partir das posições que o leitor de PDF devolve.
// Espaço grande entre dois pedaços vira "   " (três espaços), para separar colunas.

export type Pedaco = { str: string; x: number; y: number; w: number; h: number };

export function montarLinhas(pedacos: Pedaco[]): string {
  const validos = pedacos.filter((p) => p.str.trim() !== "");
  // de cima para baixo (no PDF, y cresce para cima), depois da esquerda para a direita
  validos.sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: Pedaco[][] = [];
  for (const p of validos) {
    const ultima = linhas[linhas.length - 1];
    const tol = Math.max(2, Math.min(p.h || 8, ultima?.[0].h || 8) * 0.45);
    if (ultima && Math.abs(ultima[0].y - p.y) <= tol) ultima.push(p);
    else linhas.push([p]);
  }
  // Espaço vertical grande entre duas linhas vira uma linha em branco (separa blocos, como no extrato do Mercado Pago).
  return linhas
    .map((l, i) => {
      const anterior = linhas[i - 1]?.[0];
      const altura = l[0].h || 8;
      const pula = anterior && anterior.y - l[0].y > altura * 2.2 ? "\n" : "";
      l.sort((a, b) => a.x - b.x);
      let texto = "";
      let fim = -Infinity;
      for (const p of l) {
        const altura = p.h || 8;
        const vao = p.x - fim;
        if (texto) texto += vao > altura * 0.9 ? "   " : vao > altura * 0.12 ? " " : "";
        texto += p.str;
        fim = p.x + p.w;
      }
      return pula + texto.replace(/\s+$/, "");
    })
    .join("\n");
}

/** Lê um PDF (bytes) e devolve o texto em linhas. Funciona no navegador e nos testes. */
export async function textoDoPdf(
  bytes: Uint8Array,
  pdfjs: { getDocument: (o: object) => { promise: Promise<PdfDoc> } },
): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    const pedacos: Pedaco[] = [];
    for (const it of conteudo.items) {
      if (!("str" in it)) continue;
      const [, , , d, x, y] = it.transform;
      pedacos.push({ str: it.str, x, y, w: it.width, h: it.height || Math.abs(d) });
    }
    paginas.push(montarLinhas(pedacos));
  }
  return paginas.join("\n");
}

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: ({ str: string; transform: number[]; width: number; height: number } | object)[] }>;
  }>;
};
