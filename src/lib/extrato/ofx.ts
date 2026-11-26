// Leitor de arquivos OFX (o "Exportar extrato" / "Money" / "OFX" que quase todo banco oferece).
// Serve para extrato da conta e para fatura do cartão, de qualquer banco.
// Cada transação do OFX tem um código único do banco (FITID): é ele que impede lançar a mesma coisa duas vezes.

import { limparDescricao, voltarMeses, type ArquivoLido, type Banco, type ItemLido } from "./leitores";

/** Número do banco (COMPE) e nomes que aparecem no OFX. */
const BANCOS: { banco: Banco; nome: string; codigos: string[]; texto: RegExp }[] = [
  { banco: "nubank", nome: "Nubank", codigos: ["260", "0260"], texto: /nu\s?pagamentos|nubank/i },
  { banco: "mercado_pago", nome: "Mercado Pago", codigos: ["323", "0323"], texto: /mercado\s?pago/i },
  { banco: "sicredi", nome: "Sicredi", codigos: ["748", "0748"], texto: /sicredi/i },
  { banco: "inter", nome: "Inter", codigos: ["077", "77", "0077"], texto: /banco inter|\binter\b/i },
  { banco: "banco_do_brasil", nome: "Banco do Brasil", codigos: ["001", "1", "0001"], texto: /banco do brasil/i },
];

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Abre os bytes do arquivo no jeito certo (OFX antigo costuma vir em Windows-1252, com acento quebrado em UTF-8). */
export function decodificarOfx(bytes: Uint8Array): string {
  const cabeca = new TextDecoder("latin1").decode(bytes.slice(0, 600));
  if (/CHARSET:\s*(1252|ISO-8859-1|WINDOWS-1252)/i.test(cabeca) || /encoding="(windows-1252|iso-8859-1)"/i.test(cabeca)) {
    return new TextDecoder("windows-1252").decode(bytes);
  }
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

/** É um OFX? (cabeçalho OFXHEADER ou a tag <OFX>) */
export const ehOfx = (texto: string) => /OFXHEADER|<OFX>/i.test(texto.slice(0, 2000));

/** Valor de uma tag. Funciona no OFX antigo (sem fechar a tag) e no novo (XML). */
function tag(bloco: string, nome: string): string | undefined {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  const v = m?.[1].trim();
  return v ? desfazerEntidades(v) : undefined;
}

const desfazerEntidades = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** "20261105120000[-3:BRT]" -> "2026-11-05" */
function data(s: string | undefined): string | undefined {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** "-1234.56", "-1234,56", "1.234,56" -> número */
function numero(s: string | undefined): number {
  if (!s) return NaN;
  let t = s.replace(/\s/g, "");
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  return Number(t);
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

function qualBanco(texto: string): { banco: Banco; nome: string } {
  const codigo = (tag(texto, "BANKID") ?? tag(texto, "FID") ?? "").replace(/^0+(?=\d)/, "");
  const org = tag(texto, "ORG") ?? "";
  const porCodigo = BANCOS.find((b) => b.codigos.some((c) => c.replace(/^0+(?=\d)/, "") === codigo));
  const porNome = BANCOS.find((b) => b.texto.test(org));
  const achado = porNome ?? porCodigo;
  return achado ? { banco: achado.banco, nome: achado.nome } : { banco: "outro", nome: org || "banco" };
}

/** Parcela escrita no texto: "Parcela 2/10", "PARC 02/10", "Loja 2 de 10". */
function parcelaDoTexto(t: string): { resto: string; numero: number; de: number } | undefined {
  const m = t.match(/^(.*?)\s*[-–]?\s*(?:parcela|parc\.?)\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i) ?? t.match(/^(.*?)\s+(\d{1,2})\/(\d{1,2})$/);
  if (!m) return undefined;
  const numero = +m[2];
  const de = +m[3];
  if (de < 2 || numero < 1 || numero > de || de > 48) return undefined;
  return { resto: m[1].trim(), numero, de };
}

export function lerOfx(texto: string): ArquivoLido | null {
  if (!ehOfx(texto)) return null;
  const fatura = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto);
  const { banco, nome } = qualBanco(texto);
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);

  const itens: ItemLido[] = [];
  const vistos = new Map<string, number>();
  for (const b of blocos) {
    const valor = numero(tag(b, "TRNAMT"));
    const dia = data(tag(b, "DTPOSTED")) ?? data(tag(b, "DTUSER"));
    if (!dia || !Number.isFinite(valor) || !valor) continue;
    const nomeTr = tag(b, "NAME") ?? "";
    const memo = tag(b, "MEMO") ?? "";
    // alguns bancos põem o texto útil no NAME, outros no MEMO; junta os dois sem repetir
    const original = (memo && nomeTr && !memo.includes(nomeTr) && !nomeTr.includes(memo) ? `${nomeTr} ${memo}` : memo || nomeTr).replace(/\s+/g, " ").trim();
    let descricao = limparDescricao(original || (valor > 0 ? "Entrada" : "Saída"));
    let dataItem = dia;
    let parcela: ItemLido["parcela"];
    if (fatura) {
      const p = parcelaDoTexto(descricao);
      if (p) {
        descricao = p.resto || descricao;
        parcela = { numero: p.numero, de: p.de };
        // o Nubank põe a data da parcela; a compra foi (número - 1) meses antes
        if (banco === "nubank") dataItem = voltarMeses(dia, p.numero - 1);
      }
    }
    // Alguns bancos repetem o FITID em transações diferentes; com a data e o valor junto o código fica único.
    const fitid = tag(b, "FITID");
    let idBanco: string | undefined;
    if (fitid) {
      idBanco = `${banco}:${fitid}:${dia}:${centavos(valor)}`;
      const n = (vistos.get(idBanco) ?? 0) + 1;
      vistos.set(idBanco, n);
      if (n > 1) idBanco += `#${n}`;
    }
    itens.push({
      data: dataItem,
      descricao,
      original: original || descricao,
      valor: centavos(Math.abs(valor)),
      sinal: valor > 0 ? "entra" : "sai",
      parcela,
      idBanco,
    });
  }

  itens.sort((a, b) => a.data.localeCompare(b.data));
  const datas = itens.map((i) => i.data);
  const ini = data(tag(texto, "DTSTART")) ?? datas[0];
  const fim = data(tag(texto, "DTEND")) ?? datas[datas.length - 1];

  // Na fatura dá para conferir: compras menos créditos (sem o pagamento da fatura anterior) = saldo devedor do arquivo.
  let soma: number;
  let totalDoBanco: number;
  let confere = false;
  let semTotal = true;
  if (fatura) {
    soma = centavos(itens.filter((i) => !(i.sinal === "entra" && /pagamento/i.test(i.original))).reduce((s, i) => s + (i.sinal === "sai" ? i.valor : -i.valor), 0));
    const saldo = numero(tag(texto.split(/<\/BANKTRANLIST>/i)[1] ?? "", "BALAMT"));
    totalDoBanco = Number.isFinite(saldo) ? centavos(Math.abs(saldo)) : soma;
    if (Number.isFinite(saldo) && Math.abs(totalDoBanco - soma) < 0.01) {
      confere = true;
      semTotal = false;
    }
  } else {
    soma = centavos(itens.reduce((s, i) => s + (i.sinal === "entra" ? i.valor : -i.valor), 0));
    totalDoBanco = soma;
  }

  const periodo = ini && fim ? ` de ${dataBr(ini)} a ${dataBr(fim)}` : "";
  return {
    banco,
    tipo: fatura ? "fatura" : "extrato",
    titulo: `${fatura ? "Fatura" : "Extrato"} ${nome} (OFX)${periodo}`,
    itens,
    soma,
    totalDoBanco,
    confere,
    formato: "ofx",
    semTotal,
  };
}
