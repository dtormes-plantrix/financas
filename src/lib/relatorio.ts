// Relatório das finanças da casa pelo WhatsApp.
//  - Toda segunda: resumo da semana (gastos dos últimos 7 dias, orçamento, contas
//    dos próximos 7 dias e a sobra prevista).
//  - Dia 1: fechamento do mês anterior.
//  - Todo dia: aviso quando uma categoria passa de 90% (ou estoura) o orçamento.
// Aqui só se monta o texto (dá para testar sem a Meta). Quem envia é /api/relatorio.

import { calendario } from "./calendario";
import { chaveMes, lerData, nomeMes, somarMeses, type Mes } from "./fatura";
import { dataCurta, reais } from "./formato";
import { sobraPrevista } from "./negocios";
import { categoriaDe, faltaGastar, gastosPorCategoria, type ItemOrcamento } from "./orcamento";
import { noMes, resumoDoMes } from "./painel";
import type { Dados } from "./dados";
import type { Lancamento } from "./tipos";

export const ENDERECO_APP = "https://financas-eight-mocha.vercel.app";

export type TipoRelatorio = "semanal" | "fechamento";

const r2 = (v: number) => Math.round(v * 100) / 100;
const soma = (ls: Lancamento[]) => r2(ls.reduce((s, l) => s + Number(l.valor), 0));
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (gasto: number, orcamento: number) => `${Math.round((gasto / orcamento) * 100)}%`;

/** Dia 1 = fechamento; segunda-feira = resumo da semana; outros dias, nada. */
export function relatorioDoDia(hoje: string): TipoRelatorio | null {
  const d = lerData(hoje);
  if (d.dia === 1) return "fechamento";
  return new Date(Date.UTC(d.ano, d.mes - 1, d.dia)).getUTCDay() === 1 ? "semanal" : null;
}

function mesDe(hoje: string): Mes {
  const d = lerData(hoje);
  return { ano: d.ano, mes: d.mes };
}

function voltarDias(hoje: string, dias: number): string {
  const d = lerData(hoje);
  return new Date(Date.UTC(d.ano, d.mes - 1, d.dia - dias)).toISOString().slice(0, 10);
}

/** Categorias da casa (as dos negócios ficam de fora). */
function categoriasDaCasa(dados: Dados) {
  const dosNegocios = new Set(dados.grupos.filter((g) => g.negocio_id).map((g) => g.id));
  return dados.categorias.filter((c) => !c.grupo_id || !dosNegocios.has(c.grupo_id));
}

/** As mesmas contas do painel: mês atual e mês seguinte. */
export function previsao(dados: Dados, hoje: string) {
  const atual = mesDe(hoje);
  const seguinte = somarMeses(atual, 1);
  const orcamento = gastosPorCategoria(categoriasDaCasa(dados), dados.lancamentos, dados.regras, atual, hoje, true);
  const base = { ...dados, hoje };
  const queRepassam = dados.negocios.filter((n) => n.ativo && n.fonte_id && /studio/i.test(n.nome));
  const previsto = (m: Mes) =>
    Object.fromEntries(queRepassam.map((n) => [n.fonte_id!, sobraPrevista(n, m, dados.lancamentosNegocios)]));
  return {
    orcamento,
    rAtual: resumoDoMes(atual, { ...base, previstoDasFontes: previsto(atual) }),
    rSeguinte: resumoDoMes(seguinte, { ...base, reservaOrcamento: faltaGastar(orcamento), previstoDasFontes: previsto(seguinte) }),
  };
}

const saidas = (dados: Dados) => dados.lancamentos.filter((l) => l.tipo === "saida");

function linhaOrcamento(i: ItemOrcamento): string {
  const sinal = i.situacao === "estourou" ? "🔴" : i.situacao === "acima" ? "🟡" : "🟢";
  return `${sinal} ${i.categoria.nome}: ${reais(i.gasto)} de ${reais(i.orcamento)} (${pct(i.gasto, i.orcamento)})`;
}

/** Maiores categorias de gasto de uma lista de saídas. */
function maioresCategorias(dados: Dados, ls: Lancamento[], quantas: number): string[] {
  const nomes = new Map(dados.categorias.map((c) => [c.id, c.nome]));
  const total = new Map<string, number>();
  for (const l of ls) {
    const nome = nomes.get(categoriaDe(l, dados.regras) ?? "") ?? "Sem categoria";
    total.set(nome, (total.get(nome) ?? 0) + Number(l.valor));
  }
  return [...total.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, quantas)
    .map(([nome, v]) => `• ${nome}: ${reais(r2(v))}`);
}

const sobraOuFalta = (v: number) => (v < 0 ? `faltar ${reais(-v)} ⚠️` : `sobrar ${reais(v)}`);

/** Resumo da semana (enviado na segunda). */
export function textoSemanal(dados: Dados, hoje: string): string {
  const desde = voltarDias(hoje, 7);
  const ontem = voltarDias(hoje, 1);
  const daSemana = saidas(dados).filter((l) => l.data >= desde && l.data <= ontem);
  const mes = mesDe(hoje);
  const doMes = dados.lancamentos.filter((l) => noMes(l.data, mes));
  const { orcamento, rAtual, rSeguinte } = previsao(dados, hoje);
  const cal = calendario(dados, hoje);
  const contas = [...cal.vencidas, ...cal.hoje, ...cal.semana];

  return [
    `📊 *Resumo da semana* (${dataCurta(desde)} a ${dataCurta(ontem)})`,
    `Gastos: ${reais(soma(daSemana))} em ${daSemana.length} lançamento${daSemana.length === 1 ? "" : "s"}`,
    ...maioresCategorias(dados, daSemana, 3),
    "",
    `*${maiuscula(nomeMes(mes))} até agora*`,
    `Entrou: ${reais(soma(doMes.filter((l) => l.tipo === "entrada")))}`,
    `Gastos (com cartão): ${reais(soma(doMes.filter((l) => l.tipo === "saida")))}`,
    ...(orcamento.length ? ["", "*Orçamento*", ...orcamento.map(linhaOrcamento)] : []),
    "",
    "*Contas dos próximos 7 dias*",
    ...(contas.length
      ? contas.map((c) => `• ${c.vence < hoje ? "⚠️ vencida " : ""}${dataCurta(c.vence)} ${c.nome}: ${reais(c.valor)}`)
      : ["Nenhuma conta a pagar."]),
    "",
    "*Previsão*",
    `${maiuscula(nomeMes(rAtual.mes))}: vai ${sobraOuFalta(rAtual.sobra)}`,
    `${maiuscula(nomeMes(rSeguinte.mes))}: vai ${sobraOuFalta(rSeguinte.sobra)}`,
    "",
    ENDERECO_APP,
  ].join("\n");
}

/** Fechamento do mês anterior (enviado no dia 1). */
export function textoFechamento(dados: Dados, hoje: string): string {
  const mes = somarMeses(mesDe(hoje), -1);
  const antes = somarMeses(mes, -1);
  const gastosDo = (m: Mes) => saidas(dados).filter((l) => noMes(l.data, m));
  const gastos = soma(gastosDo(mes));
  const gastosAntes = soma(gastosDo(antes));
  const r = resumoDoMes(mes, { ...dados, hoje });
  const resultado = r2(r.recebido - r.gastoAVista - r.faturas);
  const orcamento = gastosPorCategoria(categoriasDaCasa(dados), dados.lancamentos, dados.regras, mes, hoje, true);
  const orcado = r2(orcamento.reduce((s, i) => s + i.orcamento, 0));
  const gastoOrcado = r2(orcamento.reduce((s, i) => s + i.gasto, 0));
  const { rAtual } = previsao(dados, hoje);
  const variacao = gastosAntes > 0 ? Math.round(((gastos - gastosAntes) / gastosAntes) * 100) : null;

  return [
    `📅 *Fechamento de ${nomeMes(mes, true)}*`,
    `Entrou: ${reais(r.recebido)}`,
    `Gastos (com cartão): ${reais(gastos)}` +
      (variacao === null ? "" : ` (${variacao >= 0 ? "+" : ""}${variacao}% em relação a ${nomeMes(antes)})`),
    `Pago no mês (à vista + faturas): ${reais(r2(r.gastoAVista + r.faturas))}`,
    `${resultado < 0 ? "Faltou" : "Sobrou"}: ${reais(Math.abs(resultado))}${resultado < 0 ? " ⚠️" : ""}`,
    "",
    "*Onde mais gastou*",
    ...maioresCategorias(dados, gastosDo(mes), 5),
    ...(orcamento.length
      ? ["", `*Orçamento*: ${reais(gastoOrcado)} de ${reais(orcado)}`, ...orcamento.map(linhaOrcamento)]
      : []),
    "",
    `*${maiuscula(nomeMes(rAtual.mes))}*: a previsão é ${sobraOuFalta(rAtual.sobra)}`,
    "",
    ENDERECO_APP,
  ].join("\n");
}

export function textoRelatorio(tipo: TipoRelatorio, dados: Dados, hoje: string) {
  return tipo === "semanal" ? textoSemanal(dados, hoje) : textoFechamento(dados, hoje);
}

/**
 * Os 3 campos do modelo "relatorio_financas" aprovado pela Meta:
 * "O {{1}} das finanças da casa está pronto. A previsão para {{2}} é {{3}}."
 */
export function camposDoModelo(tipo: TipoRelatorio, dados: Dados, hoje: string): [string, string, string] {
  const { rAtual, rSeguinte } = previsao(dados, hoje);
  const r = tipo === "semanal" ? rSeguinte : rAtual;
  const titulo = tipo === "semanal" ? "resumo da semana" : `fechamento de ${nomeMes(somarMeses(mesDe(hoje), -1))}`;
  return [titulo, nomeMes(r.mes), sobraOuFalta(r.sobra).replace(" ⚠️", "")];
}

// ───────── aviso de orçamento ─────────

export type AvisoOrcamento = { chave: string; nivel: 90 | 100; item: ItemOrcamento };

/**
 * Categorias que passaram de 90% ou estouraram o orçamento deste mês.
 * `chave` evita repetir o aviso: cada nível é avisado uma vez por mês.
 */
export function avisosDeOrcamento(dados: Dados, hoje: string, jaAvisados: Set<string>): AvisoOrcamento[] {
  const mes = mesDe(hoje);
  const itens = gastosPorCategoria(categoriasDaCasa(dados), dados.lancamentos, dados.regras, mes, hoje, true);
  const avisos: AvisoOrcamento[] = [];
  for (const item of itens) {
    const fracao = item.gasto / item.orcamento;
    const nivel = fracao >= 1 ? 100 : fracao >= 0.9 ? 90 : null;
    if (!nivel) continue;
    const chave = `orcamento:${chaveMes(mes)}:${item.categoria.id}:${nivel}`;
    if (!jaAvisados.has(chave)) avisos.push({ chave, nivel, item });
  }
  return avisos;
}

export function textoAviso(a: AvisoOrcamento): string {
  const { categoria, gasto, orcamento } = a.item;
  const cabeca = a.nivel === 100 ? `🔴 *${categoria.nome}* estourou o orçamento do mês.` : `🟡 *${categoria.nome}* já usou ${pct(gasto, orcamento)} do orçamento do mês.`;
  const resto = r2(orcamento - gasto);
  return [
    cabeca,
    `Gasto: ${reais(gasto)} de ${reais(orcamento)}.`,
    resto >= 0 ? `Restam ${reais(resto)}.` : `Passou ${reais(-resto)}.`,
  ].join("\n");
}

/**
 * Os 4 campos do modelo "aviso_orcamento":
 * "A categoria {{1}} já chegou a {{2}} do orçamento do mês. Gasto até agora: {{3}} de {{4}}."
 */
export function camposDoAviso(a: AvisoOrcamento): [string, string, string, string] {
  const { categoria, gasto, orcamento } = a.item;
  return [categoria.nome, pct(gasto, orcamento), reais(gasto), reais(orcamento)];
}
