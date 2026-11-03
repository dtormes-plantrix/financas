// Leitura de comprovantes (foto ou PDF) com a IA da Anthropic.
// A parte que conversa com a IA roda só no servidor (rota /api/comprovante),
// porque a chave da API não pode ficar no celular.

import type { Forma, TipoLancamento } from "./tipos";

export type Leitura = {
  tipo: TipoLancamento;
  valor: number;
  data: string | null; // AAAA-MM-DD
  descricao: string;
  forma: Forma;
  parcelas: number;
  instituicao: string | null; // banco ou cartão do casal usado (de onde saiu, ou onde entrou)
  instituicao_destino: string | null; // só em transferência entre contas do casal
  categoria: string | null;
  final_cartao: string | null; // 4 últimos dígitos do cartão, quando aparecem
};

export type Contexto = { pessoas?: string[]; contas?: string[]; categorias?: string[]; hoje: string };

export const MODELO = "claude-haiku-5-5";

export const FERRAMENTA = {
  name: "registrar_lancamento",
  description: "Registra o lançamento lido no comprovante.",
  input_schema: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["saida", "entrada", "transferencia"] },
      valor: { type: "number", description: "Valor total em reais, ex.: 1234.56" },
      data: { type: ["string", "null"], description: "Data do pagamento, AAAA-MM-DD" },
      descricao: { type: "string", description: "Curta: nome do estabelecimento ou da pessoa, ex.: 'Supermercado Big', 'Pix para Maria Souza'" },
      forma: { type: "string", enum: ["pix", "credito", "debito", "dinheiro"] },
      parcelas: { type: "integer", description: "Número de parcelas no crédito; 1 se à vista" },
      instituicao: { type: ["string", "null"], description: "Banco ou cartão do casal usado, ex.: 'Mercado Pago', 'Nubank', 'Sicredi'" },
      instituicao_destino: { type: ["string", "null"], description: "Só em transferência: banco do casal que recebeu" },
      categoria: { type: ["string", "null"], description: "Uma das categorias da lista, escrita igual, ou null" },
      final_cartao: { type: ["string", "null"], description: "4 últimos dígitos do cartão, se aparecerem (ex.: ****7557 -> '7557')" },
    },
    required: ["tipo", "valor", "data", "descricao", "forma", "parcelas", "instituicao", "instituicao_destino", "categoria", "final_cartao"],
  },
} as const;

export function instrucoes(c: Contexto): string {
  const pessoas = c.pessoas?.length ? c.pessoas.join(", ") : "Diego Tormes e a esposa Jô";
  return [
    "Você lê comprovantes brasileiros (Pix, cartão, boleto, nota) para um app de finanças de um casal.",
    `O casal: ${pessoas}. Hoje é ${c.hoje}.`,
    c.contas?.length ? `Contas e cartões do casal: ${c.contas.join("; ")}.` : "",
    "Regras:",
    "- saida: o casal pagou alguém. entrada: alguém pagou o casal. transferencia: Pix de uma conta do casal para outra conta do casal (ex.: Diego para Jô).",
    "- forma: pix para Pix/TED/transferência; credito ou debito para cartão; boleto pago na conta conta como pix.",
    "- valor: o total pago, sem tarifas separadas. Em compra parcelada, o valor total da compra.",
    "- data: a do pagamento. Se faltar o ano, use o mais provável perto de hoje.",
    "- descricao: o nome da loja ou da pessoa que recebeu (não a maquininha, ex.: Cielo, Rede, Stone, nem o nome do casal).",
    "- instituicao: o banco ou cartão do casal que aparece (o app de onde saiu o Pix, ou o cartão usado). Use o nome curto (Mercado Pago, Nubank, Sicredi).",
    c.categorias?.length ? `- categoria: escolha uma desta lista só se tiver certeza razoável, senão null: ${c.categorias.join(", ")}.` : "- categoria: null.",
    "Chame a ferramenta registrar_lancamento uma vez. Se não for um comprovante, chame com valor 0.",
  ].filter(Boolean).join("\n");
}

/** Descobre o tipo do arquivo pelos primeiros bytes (o Atalho do iPhone nem sempre manda). */
export function tipoDoArquivo(b: Uint8Array): string | null {
  const ini = (s: string, d = 0) => [...s].every((ch, i) => b[d + i] === ch.charCodeAt(0));
  if (ini("%PDF")) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && ini("PNG", 1)) return "image/png";
  if (ini("GIF8")) return "image/gif";
  if (ini("RIFF") && ini("WEBP", 8)) return "image/webp";
  if (ini("ftyp", 4)) return "image/heic";
  return null;
}

const FORMAS: Forma[] = ["pix", "credito", "debito", "dinheiro"];
const TIPOS: TipoLancamento[] = ["saida", "entrada", "transferencia"];

/** Confere e arruma o que a IA devolveu. */
export function normalizar(x: Record<string, unknown>): Leitura {
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const valor = Math.round(Math.abs(Number(x.valor) || 0) * 100) / 100;
  const data = texto(x.data);
  const forma = FORMAS.includes(x.forma as Forma) ? (x.forma as Forma) : "pix";
  const tipo = TIPOS.includes(x.tipo as TipoLancamento) ? (x.tipo as TipoLancamento) : "saida";
  return {
    tipo,
    valor,
    data: data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null,
    descricao: (texto(x.descricao) ?? "").slice(0, 80),
    forma: tipo === "entrada" && forma === "credito" ? "pix" : forma,
    parcelas: forma === "credito" ? Math.min(48, Math.max(1, Math.round(Number(x.parcelas) || 1))) : 1,
    instituicao: texto(x.instituicao),
    instituicao_destino: texto(x.instituicao_destino),
    categoria: texto(x.categoria),
    final_cartao: (texto(x.final_cartao) ?? "").replace(/\D/g, "").slice(-4) || null,
  };
}

/** Pede para a IA ler o arquivo. Roda só no servidor. */
export async function lerComprovante(chaveApi: string, base64: string, tipoArquivo: string, c: Contexto): Promise<Leitura> {
  const bloco =
    tipoArquivo === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: tipoArquivo, data: base64 } }
      : { type: "image", source: { type: "base64", media_type: tipoArquivo, data: base64 } };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": chaveApi, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 600,
      system: instrucoes(c),
      tools: [FERRAMENTA],
      tool_choice: { type: "tool", name: FERRAMENTA.name },
      messages: [{ role: "user", content: [bloco, { type: "text", text: "Leia este comprovante." }] }],
    }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = corpo?.error?.message ?? `erro ${r.status}`;
    if (r.status === 401) throw new Error("A chave da Anthropic está errada (confira ANTHROPIC_API_KEY na Vercel).");
    if (/credit balance/i.test(msg)) throw new Error("Acabou o crédito na conta da Anthropic.");
    throw new Error(`A IA não conseguiu ler: ${msg}`);
  }
  const uso = (corpo.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  if (!uso) throw new Error("A IA não devolveu a leitura.");
  return normalizar(uso.input);
}

// ---------- usado no app ----------

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Acha a conta ou o cartão cujo nome combina com o banco lido. */
export function combinar<T extends { nome: string }>(lista: T[], instituicao: string | null): T | undefined {
  if (!instituicao) return undefined;
  const alvo = semAcento(instituicao).replace(/nu pagamentos|nu financeira/, "nubank").replace("mercadopago", "mercado pago");
  return lista.find((i) => alvo.includes(semAcento(i.nome)) || semAcento(i.nome).includes(alvo))
    ?? lista.find((i) => semAcento(i.nome).split(/\s+/).some((p) => p.length > 3 && alvo.includes(p)));
}

/** Leitura -> parâmetros do endereço /lancar (usado pelo Atalho do iPhone). */
export function paraEndereco(l: Leitura): string {
  const p = new URLSearchParams({ comprovante: "1", tipo: l.tipo, valor: String(l.valor), forma: l.forma, parcelas: String(l.parcelas) });
  if (l.data) p.set("data", l.data);
  if (l.descricao) p.set("descricao", l.descricao);
  if (l.instituicao) p.set("banco", l.instituicao);
  if (l.instituicao_destino) p.set("banco_destino", l.instituicao_destino);
  if (l.categoria) p.set("categoria", l.categoria);
  if (l.final_cartao) p.set("final", l.final_cartao);
  return `/lancar?${p}`;
}

/** Parâmetros do endereço -> Leitura (null se não veio de um comprovante). */
export function doEndereco(p: URLSearchParams): Leitura | null {
  if (p.get("comprovante") !== "1") return null;
  return normalizar({
    tipo: p.get("tipo"), valor: p.get("valor"), data: p.get("data"), descricao: p.get("descricao"),
    forma: p.get("forma"), parcelas: p.get("parcelas"), instituicao: p.get("banco"),
    instituicao_destino: p.get("banco_destino"), categoria: p.get("categoria"), final_cartao: p.get("final"),
  });
}
