// Contas que se repetem todo mês (assinaturas, condomínio, luz, seguro).
// O app olha os lançamentos dos últimos meses e sugere o que parece fixo;
// a pessoa confirma, e aí a conta entra no previsto dos meses seguintes.

import { lerData, somarMeses, type Mes } from "./fatura";
import type { Compromisso, Lancamento } from "./tipos";

/** Palavras do texto do extrato, sem números, acentos e pontuação: "Netflix.com 21/09" vira "NETFLIX COM". */
export function chaveDoExtrato(descricao: string | null): string {
  if (!descricao) return "";
  return descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim()
    .split(" ")
    // tira prefixos de maquininha ("DL*", "MP *", "PG *") quando sobra texto depois
    .filter((p, i, todas) => !(p.length <= 2 && i < todas.length - 1 && todas.slice(0, i).every((x) => x.length <= 2)))
    .slice(0, 3)
    .join(" ");
}

/** O texto começa com as mesmas palavras da busca? ("NETFLIX" serve para "NETFLIX COM" e "NETFLIX ENTRETENIMENTO") */
const comeca = (chave: string, busca: string) => chave === busca || chave.startsWith(busca + " ");

/** Palavras iguais no começo de todos os textos. */
function comecoComum(chaves: string[]): string {
  const partes = chaves.map((c) => c.split(" "));
  const comum: string[] = [];
  for (let i = 0; i < partes[0].length && partes.every((p) => p[i] === partes[0][i]); i++) comum.push(partes[0][i]);
  return comum.join(" ");
}

/** O lançamento é o pagamento desta conta fixa? (mesmo texto do extrato e mesmo meio de pagar) */
export function pagaConta(l: Lancamento, c: Compromisso): boolean {
  if (l.tipo !== "saida" || l.negocio_id) return false;
  if (l.compromisso_id) return l.compromisso_id === c.id;
  if (!c.busca || !comeca(chaveDoExtrato(l.descricao), c.busca)) return false;
  if (c.cartao_id) return l.forma === "credito" && l.cartao_id === c.cartao_id;
  return l.forma !== "credito";
}

export type Sugestao = {
  chave: string;
  nome: string; // descrição como veio do extrato
  valor: number; // total do mês mais recente
  dia: number;
  cartao_id: string | null;
  conta_id: string | null;
  meses: number;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const indice = (m: Mes) => m.ano * 12 + m.mes;

/**
 * Procura saídas que começam com a mesma palavra, no mesmo cartão ou conta, e que
 * no mês mais recente têm o mesmo valor (±15%) de algum mês anterior dos últimos
 * quatro. Ignora o que aparece mais de três vezes num mês (mercado, Uber).
 */
export function sugerirRecorrentes(lancamentos: Lancamento[], compromissos: Compromisso[], hoje: string): Sugestao[] {
  const d = lerData(hoje);
  const mesHoje: Mes = { ano: d.ano, mes: d.mes };
  const desde = indice(somarMeses(mesHoje, -4));
  const conhecidas = compromissos.map((c) => c.busca).filter((b): b is string => !!b);

  const grupos = new Map<string, Lancamento[]>();
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || l.negocio_id || l.compromisso_id || (l.parcelas || 1) > 1) continue;
    const chave = chaveDoExtrato(l.descricao);
    if (!chave || conhecidas.some((b) => comeca(chave, b))) continue;
    const dl = lerData(l.data);
    if (indice({ ano: dl.ano, mes: dl.mes }) < desde) continue;
    const onde = l.forma === "credito" ? `cartao:${l.cartao_id}` : "conta";
    const k = `${onde}|${chave.split(" ")[0]}`;
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }

  const parecido = (a: number, b: number) => Math.abs(a - b) <= Math.max(a, b) * 0.15;
  const sugestoes: Sugestao[] = [];
  for (const lista of grupos.values()) {
    const porMes = new Map<string, Lancamento[]>();
    for (const l of lista) porMes.set(l.data.slice(0, 7), [...(porMes.get(l.data.slice(0, 7)) ?? []), l]);
    if (porMes.size < 2 || [...porMes.values()].some((x) => x.length > 3)) continue;
    const ultimoMes = [...porMes.keys()].sort().at(-1)!;
    // precisa ter aparecido num dos dois últimos meses, senão já parou
    const u = lerData(`${ultimoMes}-01`);
    if (indice({ ano: u.ano, mes: u.mes }) < indice(somarMeses(mesHoje, -2))) continue;
    const anteriores = lista.filter((l) => l.data.slice(0, 7) !== ultimoMes);
    const doUltimo = porMes.get(ultimoMes)!.filter((l) => anteriores.some((a) => parecido(Number(a.valor), Number(l.valor))));
    if (doUltimo.length === 0) continue;
    const pares = anteriores.filter((a) => doUltimo.some((l) => parecido(Number(a.valor), Number(l.valor))));
    const ref = doUltimo[doUltimo.length - 1];
    sugestoes.push({
      chave: comecoComum([...doUltimo, ...pares].map((l) => chaveDoExtrato(l.descricao))),
      nome: ref.descricao ?? "",
      valor: r2(doUltimo.reduce((s, l) => s + Number(l.valor), 0)),
      dia: lerData(ref.data).dia,
      cartao_id: ref.forma === "credito" ? ref.cartao_id : null,
      conta_id: ref.forma === "credito" ? null : ref.conta_id,
      meses: new Set([...doUltimo, ...pares].map((l) => l.data.slice(0, 7))).size,
    });
  }
  return sugestoes.sort((a, b) => b.valor - a.valor);
}
