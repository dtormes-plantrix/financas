// Partes do WhatsApp que não dependem da internet (dá para testar sem a Meta).
// A rota /api/whatsapp usa estas funções para receber o recado, montar o lançamento e responder.

import { createHmac, timingSafeEqual } from "node:crypto";
import { combinar, type Leitura } from "./comprovante";
import { dataCurta, NOME_FORMA, reais } from "./formato";
import { sugerirCategorias } from "./sugestao";
import type { Cartao, Categoria, Conta, Dono, Lancamento, RegraCategoria } from "./tipos";

/** Confere se o recado veio mesmo da Meta (cabeçalho X-Hub-Signature-256). */
export function assinaturaValida(corpo: string, assinatura: string | null, segredo: string): boolean {
  if (!assinatura || !segredo) return false;
  const esperada = "sha256=" + createHmac("sha256", segredo).update(corpo, "utf8").digest("hex");
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Só dígitos; tira o 9 extra do celular brasileiro (o WhatsApp às vezes manda sem ele). */
export function numeroComparavel(numero: string): string {
  const d = numero.replace(/\D/g, "");
  return d.length === 13 && d.startsWith("55") && d[4] === "9" ? d.slice(0, 4) + d.slice(5) : d;
}

/** "5565999990000:diego, 5565988880000:jo" -> quem é cada número. */
export function lerPessoas(texto: string | undefined): Map<string, Exclude<Dono, "casa">> {
  const mapa = new Map<string, Exclude<Dono, "casa">>();
  for (const par of (texto ?? "").split(/[,;\n]/)) {
    const [numero, quem] = par.split(":").map((s) => s.trim().toLowerCase());
    if (numero && (quem === "diego" || quem === "jo")) mapa.set(numeroComparavel(numero), quem);
  }
  return mapa;
}

export function quemEnviou(numero: string, pessoas: Map<string, Exclude<Dono, "casa">>) {
  return pessoas.get(numeroComparavel(numero)) ?? null;
}

export type Recado =
  | { id: string; de: string; tipo: "texto"; texto: string }
  | { id: string; de: string; tipo: "arquivo"; midiaId: string; legenda: string }
  | { id: string; de: string; tipo: "botao"; resposta: "sim" | "nao" }
  | { id: string; de: string; tipo: "outro" };

/** Tira os recados do pacote que a Meta manda (ignora avisos de entregue/lido). */
export function recadosDoPacote(pacote: unknown): Recado[] {
  const lista: Recado[] = [];
  const entradas = (pacote as { entry?: { changes?: { value?: { messages?: unknown[] } }[] }[] })?.entry ?? [];
  for (const e of entradas) {
    for (const ch of e.changes ?? []) {
      for (const m of (ch.value?.messages ?? []) as Record<string, any>[]) {
        const base = { id: String(m.id ?? ""), de: String(m.from ?? "") };
        if (!base.id || !base.de) continue;
        if (m.type === "text") lista.push({ ...base, tipo: "texto", texto: String(m.text?.body ?? "") });
        else if (m.type === "interactive" && m.interactive?.type === "button_reply")
          lista.push({ ...base, tipo: "botao", resposta: m.interactive.button_reply?.id === "sim" ? "sim" : "nao" });
        else if (m.type === "button") lista.push({ ...base, tipo: "botao", resposta: ehSim(String(m.button?.text ?? "")) ? "sim" : "nao" });
        else if (m.type === "image" || m.type === "document")
          lista.push({ ...base, tipo: "arquivo", midiaId: String(m[m.type]?.id ?? ""), legenda: String(m[m.type]?.caption ?? "") });
        else lista.push({ ...base, tipo: "outro" });
      }
    }
  }
  return lista;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function ehDesfazer(texto: string): boolean {
  return /^(desfaz|desfazer|apaga|apagar|cancela|cancelar)\b/.test(semAcento(texto));
}

/** Resposta à pergunta "Lançar mesmo assim?" digitada em vez de tocar no botão. */
export function ehSim(texto: string): boolean {
  return /^(sim|s|pode|lanca|lancar|isso|ok|yes)\b/.test(semAcento(texto)) && semAcento(texto).split(" ").length <= 3;
}

export function ehNao(texto: string): boolean {
  return /^(nao|n|no|deixa|esquece)\b/.test(semAcento(texto)) && semAcento(texto).split(" ").length <= 3;
}

export function ehAjuda(texto: string): boolean {
  return /^(oi|ola|ajuda|menu|help|bom dia|boa tarde|boa noite)\b/.test(semAcento(texto));
}

export const AJUDA = [
  "Oi! Me mande um gasto ou uma entrada que eu lanço no app. Exemplos:",
  "• mercado 85 cartão MP",
  "• gasolina 200 pix Sicredi",
  "• recebi 1500 aluguel",
  "• foto ou PDF de um comprovante",
  "Errou? Responda *desfaz* que eu apago o último que lancei.",
].join("\n");

type Cadastros = {
  contas: Conta[];
  cartoes: Cartao[];
  categoriasDaCasa: Categoria[];
  regras: RegraCategoria[];
  lancamentos: Lancamento[];
};

/** Leitura da IA -> registro da tabela lancamentos, escolhendo conta, cartão e categoria. */
export function montarLancamento(
  l: Leitura,
  quem: Exclude<Dono, "casa">,
  c: Cadastros,
  extra: { hoje: string; whatsappId: string; criadoPor: string | null },
): Partial<Lancamento> & { whatsapp_id: string } {
  const contas = c.contas.filter((x) => x.ativo);
  const cartoes = c.cartoes.filter((x) => x.ativo);
  const daPessoa = <T extends { dono: Dono }>(lista: T[]) => lista.find((x) => x.dono === quem) ?? lista[0];

  const tipo = l.tipo;
  let forma = tipo === "transferencia" ? "pix" : l.forma;
  let cartao: Cartao | undefined;
  if (forma === "credito") {
    cartao = combinar(cartoes, l.instituicao) ?? daPessoa(cartoes);
    if (!cartao) forma = "pix"; // sem cartão cadastrado não dá para lançar no crédito
  }
  const conta = forma === "credito" ? undefined : combinar(contas, l.instituicao) ?? daPessoa(contas);
  const destino = tipo === "transferencia" ? combinar(contas.filter((x) => x.id !== conta?.id), l.instituicao_destino) : undefined;

  let categoria_id: string | null = null;
  if (tipo === "saida") {
    const pelaIA = l.categoria ? c.categoriasDaCasa.find((x) => semAcento(x.nome) === semAcento(l.categoria!)) : undefined;
    categoria_id = pelaIA?.id ?? sugerirCategorias(l.descricao, c.categoriasDaCasa, c.regras, c.lancamentos, 1)[0] ?? null;
  }

  return {
    tipo,
    valor: l.valor,
    data: l.data ?? extra.hoje,
    descricao: l.descricao || null,
    forma,
    conta_id: conta?.id ?? null,
    cartao_id: cartao?.id ?? null,
    parcelas: forma === "credito" ? l.parcelas : 1,
    fonte_id: null,
    categoria_id,
    de_quem: "casa",
    ...(tipo === "transferencia" ? { conta_destino_id: destino?.id ?? null } : {}),
    criado_por: extra.criadoPor,
    whatsapp_id: extra.whatsappId,
  };
}

/** Resposta curta para o WhatsApp dizendo o que foi lançado. */
export function textoConfirmacao(r: Partial<Lancamento>, c: Pick<Cadastros, "contas" | "cartoes" | "categoriasDaCasa">, hoje: string): string {
  const nomeTipo = r.tipo === "entrada" ? "Entrada" : r.tipo === "transferencia" ? "Entre contas" : "Saída";
  const onde =
    r.forma === "credito"
      ? `cartão ${c.cartoes.find((x) => x.id === r.cartao_id)?.nome ?? ""}${(r.parcelas ?? 1) > 1 ? ` em ${r.parcelas}x` : ""}`
      : `${NOME_FORMA[r.forma ?? "pix"]} ${c.contas.find((x) => x.id === r.conta_id)?.nome ?? ""}`;
  const para = r.tipo === "transferencia" ? ` → ${c.contas.find((x) => x.id === r.conta_destino_id)?.nome ?? "?"}` : "";
  const categoria = c.categoriasDaCasa.find((x) => x.id === r.categoria_id)?.nome;
  const quando = r.data === hoje ? "hoje" : dataCurta(r.data ?? hoje);
  return [
    `✅ Lancei: ${nomeTipo} de ${reais(r.valor ?? 0)}`,
    [r.descricao, categoria && `categoria ${categoria}`, `${onde.trim()}${para}`, quando].filter(Boolean).join(" · "),
    r.tipo === "saida" && !categoria ? "Sem categoria: escolha no app em Lançamentos." : "",
    "Errou? Responda *desfaz*.",
  ].filter(Boolean).join("\n");
}
