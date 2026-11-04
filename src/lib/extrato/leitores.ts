// Leitores dos PDFs dos bancos (sem IA): extrato da conta e fatura do cartão.
// Mercado Pago (conta e cartão), Sicredi (conta e cartão) e Nubank (cartão).
// Cada leitor soma o que leu e compara com o total que o banco imprime no PDF.

export type Banco = "mercado_pago" | "nubank" | "sicredi";

export type ItemLido = {
  data: string; // AAAA-MM-DD (na compra parcelada, a data da compra)
  descricao: string; // texto limpo, para mostrar e gravar
  original: string; // texto como veio no PDF (para as regras)
  valor: number; // sempre positivo
  sinal: "entra" | "sai";
  parcela?: { numero: number; de: number };
};

export type ArquivoLido = {
  banco: Banco;
  tipo: "extrato" | "fatura";
  titulo: string; // "Fatura Nubank de outubro de 2026"
  itens: ItemLido[];
  soma: number; // o que o app somou
  totalDoBanco: number; // o que o PDF diz
  confere: boolean;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "R$ -1.234,56", "−R$ 8,00", "3 799,79" -> número */
export function lerReais(s: string): number {
  const t = s.replace(/R\$/g, "").replace(/[−–]/g, "-").replace(/\s/g, "");
  const neg = t.includes("-");
  const v = Number(t.replace(/-/g, "").replace(/\./g, "").replace(",", "."));
  return neg ? -v : v;
}

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Ano de uma data "dia/mês" de fatura: meses depois do vencimento são do ano anterior. */
function anoDaFatura(mes: number, venc: { ano: number; mes: number }) {
  return mes > venc.mes ? venc.ano - 1 : venc.ano;
}

/** Volta n meses numa data, sem passar do último dia do mês. */
function voltarMeses(data: string, n: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const total = a * 12 + (m - 1) - n;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return iso(ano, mes, Math.min(d, ultimo));
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/** Tira do texto do banco o que não ajuda a reconhecer (códigos, CPF, "Pix enviado"). */
export function limparDescricao(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^(PAGAMENTO PIX|RECEBIMENTO PIX|LIQUIDACAO BOLETO( SICREDI)?|DEBITO CONVENIOS|TRANSF ENTRE CONTAS|DEBITO TED\/IB|CREDITO TED|TED RECEBIDO)\s+\d{8,14}\s*/i, "")
    .replace(/^(\d{2}[.\s]?\d{3}[.\s]?\d{3})\s+/, "")
    .replace(/^(Pix enviado|Pagamento com Pix|Pagamento de conta|Pagamento(?! de\b))\s+/i, "")
    .trim() || s.trim();
}

/** Pagamento da fatura (o dinheiro que entrou no cartão para quitar a fatura anterior). */
export const ehPagamentoDeFatura = (i: ItemLido) => i.sinal === "entra" && /^Pagamento/i.test(i.original);

/** Soma da fatura como o banco imprime: compras menos créditos, sem o pagamento da fatura anterior. */
function somaFatura(itens: ItemLido[]) {
  return centavos(itens.filter((i) => !ehPagamentoDeFatura(i)).reduce((s, i) => s + (i.sinal === "sai" ? i.valor : -i.valor), 0));
}

// ---------- Sicredi: extrato da conta ----------

function sicrediExtrato(t: string): ArquivoLido {
  const periodo = t.match(/Extrato \(Período de (\d\d\/\d\d\/\d{4}) a (\d\d\/\d\d\/\d{4})\)/);
  const ini = lerReais(t.match(/SALDO ANTERIOR\s+(-?[\d.]+,\d\d)/)?.[1] ?? "0");
  const itens: ItemLido[] = [];
  let saldoFinal = ini;
  for (const linha of t.split("\n")) {
    const m = linha.match(/^(\d\d)\/(\d\d)\/(\d{4})\s+(.+?)\s+(-?[\d.]+,\d\d)\s+(-?[\d.]+,\d\d)$/);
    if (!m) continue;
    const valor = lerReais(m[5]);
    saldoFinal = lerReais(m[6]);
    // a descrição pode vir com o código do documento numa coluna separada; fica só a primeira coluna
    const original = m[4].split(/\s{3,}/)[0].trim();
    if (!valor) continue;
    itens.push({
      data: iso(+m[3], +m[2], +m[1]),
      descricao: limparDescricao(original),
      original,
      valor: Math.abs(valor),
      sinal: valor > 0 ? "entra" : "sai",
    });
  }
  const soma = centavos(ini + itens.reduce((s, i) => s + (i.sinal === "entra" ? i.valor : -i.valor), 0));
  return {
    banco: "sicredi",
    tipo: "extrato",
    titulo: `Extrato Sicredi${periodo ? ` de ${periodo[1].slice(0, 5)} a ${periodo[2].slice(0, 5)}/${periodo[2].slice(6)}` : ""}`,
    itens,
    soma,
    totalDoBanco: saldoFinal,
    confere: Math.abs(soma - saldoFinal) < 0.01,
  };
}

// ---------- Sicredi: fatura do cartão ----------

function sicrediFatura(t: string): ArquivoLido {
  const v = t.match(/Vencimento (\d\d)\/(\d\d)\/(\d{4})/);
  const venc = v ? { ano: +v[3], mes: +v[2] } : { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
  const total = lerReais(
    t.match(/Total fatura de [a-zç]+ (-?R\$ ?[\d. ]*\d,\d\d)/)?.[1] ?? t.match(/Total desta Fatura\s+(-?[\d. ]*\d,\d\d)/)?.[1] ?? "0",
  );
  const itens: ItemLido[] = [];
  for (const linha of t.split("\n")) {
    const m = linha.match(/^(\d\d)\/([a-zç]{3}) (\d\d:\d\d)\s+(.+?)\s+(-?R\$ ?-?[\d.]+,\d\d)$/);
    if (!m) continue;
    const mes = MESES.indexOf(m[2]) + 1;
    if (!mes) continue;
    const partes = m[4].split(/\s{3,}/).map((p) => p.trim());
    let parcela: ItemLido["parcela"];
    const ultima = partes[partes.length - 1].match(/^(\d\d)\/(\d\d)$/);
    if (ultima) {
      partes.pop();
      parcela = { numero: +ultima[1], de: +ultima[2] };
    }
    const online = partes.findIndex((p) => /^(Online|Presencial|Contactless|Aproximação)$/i.test(p));
    const original = (online >= 0 ? partes.slice(online + 1) : partes).join(" ").trim();
    const valor = lerReais(m[5]);
    if (!valor) continue;
    itens.push({
      data: iso(anoDaFatura(mes, venc), mes, +m[1]),
      descricao: original,
      original,
      valor: Math.abs(valor),
      sinal: valor > 0 ? "sai" : "entra",
      parcela: parcela && parcela.de > 1 ? parcela : undefined,
    });
  }
  const soma = somaFatura(itens);
  return {
    banco: "sicredi",
    tipo: "fatura",
    titulo: `Fatura Sicredi de ${NOMES[venc.mes - 1]} de ${venc.ano}`,
    itens,
    soma,
    totalDoBanco: total,
    confere: Math.abs(soma - total) < 0.01,
  };
}

// ---------- Nubank: fatura do cartão ----------

function nubankFatura(t: string): ArquivoLido {
  const v = t.match(/Data de vencimento:\s*(\d\d) ([A-Z]{3}) (\d{4})/) ?? t.match(/FATURA (\d\d) ([A-Z]{3}) (\d{4})/);
  const venc = v ? { ano: +v[3], mes: MESES.indexOf(v[2].toLowerCase()) + 1 } : { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
  const total = lerReais(t.match(/^Total a pagar\s+(R\$ [\d.]+,\d\d)$/m)?.[1] ?? "0");
  const itens: ItemLido[] = [];
  for (const linha of t.split("\n")) {
    const m = linha.match(/^(\d\d) ([A-Z]{3})\s+(?:•+ \d{4}\s+)?(.+?)\s+([−-]?R\$ [\d.]+,\d\d)$/);
    if (!m) continue;
    const mes = MESES.indexOf(m[2].toLowerCase()) + 1;
    if (!mes) continue;
    const valor = lerReais(m[4]);
    let desc = m[3].trim();
    if (/^Saldo restante da fatura anterior/i.test(desc) && !valor) continue;
    if (!valor) continue;
    let parcela: ItemLido["parcela"];
    const p = desc.match(/^(.*?)\s*-\s*Parcela (\d+)\/(\d+)$/);
    let data = iso(anoDaFatura(mes, venc), mes, +m[1]);
    if (p) {
      desc = p[1];
      parcela = { numero: +p[2], de: +p[3] };
      // o Nubank mostra a data da parcela; a compra foi (número - 1) meses antes
      data = voltarMeses(data, parcela.numero - 1);
    }
    itens.push({
      data,
      descricao: desc,
      original: m[3].trim(),
      valor: Math.abs(valor),
      sinal: valor > 0 ? "sai" : "entra",
      parcela: parcela && parcela.de > 1 ? parcela : undefined,
    });
  }
  const soma = somaFatura(itens);
  return {
    banco: "nubank",
    tipo: "fatura",
    titulo: `Fatura Nubank de ${NOMES[venc.mes - 1]} de ${venc.ano}`,
    itens,
    soma,
    totalDoBanco: total,
    confere: Math.abs(soma - total) < 0.01,
  };
}

// ---------- Mercado Pago: fatura do cartão ----------

function mpFatura(t: string): ArquivoLido {
  const v = t.match(/Vencimento: (\d\d)\/(\d\d)\/(\d{4})/) ?? t.match(/(\d\d)\/(\d\d)\/(\d{4})\s+R\$/);
  const venc = v ? { ano: +v[3], mes: +v[2] } : { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
  const itens: ItemLido[] = [];
  let totalCartoes = 0;
  let dentroDeCartao = false;
  for (const linha of t.split("\n")) {
    if (/^Cartão (Visa|Master\w*|Elo)\b.*\[/.test(linha)) {
      dentroDeCartao = true;
      continue;
    }
    if (/^Movimentações na fatura/.test(linha) || /^Seu cartão de crédito/.test(linha)) dentroDeCartao = false;
    const tot = linha.match(/^Total\s+(R\$ [\d.]+,\d\d)$/);
    if (tot && dentroDeCartao) {
      totalCartoes += lerReais(tot[1]);
      dentroDeCartao = false;
      continue;
    }
    // pagamentos da fatura aparecem fora dos cartões ("Movimentações na fatura")
    const m = linha.match(/^(\d\d)\/(\d\d)\s+(.+?)\s+(-?R\$ ?-?[\d.]+,\d\d)$/);
    if (!m) continue;
    const mes = +m[2];
    let desc = m[3].replace(/^Compra internacional em\s+/i, "").replace(/\s{3,}/g, " ").trim();
    let parcela: ItemLido["parcela"];
    const p = desc.match(/^(.*?)\s+Parcela (\d+) de (\d+)$/);
    if (p) {
      desc = p[1];
      parcela = { numero: +p[2], de: +p[3] };
    }
    const valor = lerReais(m[4]);
    if (!valor) continue;
    const pagamento = !dentroDeCartao && /^Pagamento/i.test(desc);
    if (!dentroDeCartao && !pagamento) continue;
    itens.push({
      data: iso(anoDaFatura(mes, venc), mes, +m[1]),
      descricao: desc,
      original: m[3].trim(),
      valor: Math.abs(valor),
      // pagamento da fatura aparece positivo no PDF, mas é dinheiro que entrou no cartão
      sinal: pagamento || valor < 0 ? "entra" : "sai",
      parcela: parcela && parcela.de > 1 ? parcela : undefined,
    });
  }
  const soma = somaFatura(itens);
  return {
    banco: "mercado_pago",
    tipo: "fatura",
    titulo: `Fatura Mercado Pago de ${NOMES[venc.mes - 1]} de ${venc.ano}`,
    itens,
    soma,
    totalDoBanco: centavos(totalCartoes),
    confere: Math.abs(soma - totalCartoes) < 0.01,
  };
}

// ---------- Mercado Pago: extrato da conta ----------

const linhaMp = /^(\d\d)-(\d\d)-(\d{4})\s+(?:(.*?)\s+)?(\d{9,})\s+(R\$ -?[\d.]+,\d\d)\s+(R\$ -?[\d.]+,\d\d)$/;

function mpExtrato(t: string): ArquivoLido {
  const ini = lerReais(t.match(/Saldo inicial: (R\$ -?[\d.]+,\d\d)/)?.[1] ?? "0");
  const fim = lerReais(t.match(/Saldo final: (R\$ -?[\d.]+,\d\d)/)?.[1] ?? "0");
  const periodo = t.match(/Periodo: De (\d\d-\d\d-\d{4}) al (\d\d-\d\d-\d{4})/);
  // Só o miolo: depois de "DETALHE DOS MOVIMENTOS" e sem cabeçalhos e números de página.
  const comeco = t.indexOf("DETALHE DOS MOVIMENTOS");
  const linhas = (comeco >= 0 ? t.slice(comeco) : t)
    .split("\n")
    .slice(1)
    .filter((l) => !/^Data\s+Descrição/.test(l) && !/^\d+\/\d+$/.test(l.trim()));
  const fimMiolo = linhas.findIndex((l) => /^Data de geração/.test(l));
  const miolo = fimMiolo >= 0 ? linhas.slice(0, fimMiolo) : linhas;

  // Cada movimento é um bloco separado por linha em branco. A descrição longa quebra em várias
  // linhas, acima e abaixo da linha com a data. Bloco sem data (cortado pela troca de página)
  // continua no bloco seguinte.
  const blocos: string[][] = [[]];
  for (const l of miolo) {
    if (l.trim()) blocos[blocos.length - 1].push(l.trim());
    else if (blocos[blocos.length - 1].length) blocos.push([]);
  }
  type Mov = { m: RegExpMatchArray; antes: string[]; depois: string[] };
  const movs: Mov[] = [];
  let pendente: string[] = [];
  for (const bloco of blocos) {
    const comData = bloco.map((l, i) => (linhaMp.test(l) ? i : -1)).filter((i) => i >= 0);
    if (!comData.length) {
      pendente.push(...bloco);
      continue;
    }
    if (comData.length === 1) {
      const i = comData[0];
      movs.push({ m: bloco[i].match(linhaMp)!, antes: [...pendente, ...bloco.slice(0, i)], depois: bloco.slice(i + 1) });
      pendente = [];
      continue;
    }
    // Vários movimentos no mesmo bloco: divide as linhas soltas pela metade entre eles.
    let soltas = [...pendente];
    pendente = [];
    const doBloco: Mov[] = [];
    for (const l of bloco) {
      const m = l.match(linhaMp);
      if (!m) {
        soltas.push(l);
        continue;
      }
      const anterior = doBloco[doBloco.length - 1];
      if (anterior) {
        const quantas = Math.min(anterior.antes.length, soltas.length);
        anterior.depois = soltas.slice(0, quantas);
        soltas = soltas.slice(quantas);
      }
      doBloco.push({ m, antes: soltas, depois: [] });
      soltas = [];
    }
    doBloco[doBloco.length - 1].depois = soltas;
    movs.push(...doBloco);
  }

  const itens: ItemLido[] = [];
  for (const { m, antes, depois } of movs) {
    const original = [...antes, m[4] ?? "", ...depois].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const valor = lerReais(m[6]);
    if (!valor) continue;
    itens.push({
      data: iso(+m[3], +m[2], +m[1]),
      descricao: limparDescricao(original.replace(/^Pix recebido\s+/i, "")),
      original,
      valor: Math.abs(valor),
      sinal: valor > 0 ? "entra" : "sai",
    });
  }
  const soma = centavos(ini + itens.reduce((s, i) => s + (i.sinal === "entra" ? i.valor : -i.valor), 0));
  return {
    banco: "mercado_pago",
    tipo: "extrato",
    titulo: `Extrato Mercado Pago${periodo ? ` de ${periodo[1].slice(0, 5).replace("-", "/")} a ${periodo[2].slice(0, 5).replace("-", "/")}/${periodo[2].slice(6)}` : ""}`,
    itens,
    soma,
    totalDoBanco: fim,
    confere: Math.abs(soma - fim) < 0.01,
  };
}

// ---------- qual é o arquivo ----------

export function lerArquivo(texto: string): ArquivoLido | null {
  if (/Nu Pagamentos|Nubank/.test(texto) && /Total a pagar/.test(texto)) return nubankFatura(texto);
  if (/Extrato \(Período/.test(texto)) return sicrediExtrato(texto);
  if (/Visa Gold final|Total desta Fatura/.test(texto)) return sicrediFatura(texto);
  if (/EXTRATO DE CONTA/.test(texto) && /Saldo inicial/.test(texto)) return mpExtrato(texto);
  if (/Cartão (Visa|Master\w*|Elo)\b.*\[/.test(texto) && /Vencimento/.test(texto)) return mpFatura(texto);
  return null;
}
