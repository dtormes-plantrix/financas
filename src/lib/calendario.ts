// Calendário de contas: o que vence, por prazo (vencidas, hoje, 7 dias, 30 dias).
//
// Junta três coisas que o app já conhece, sem tabela nova:
// - faturas dos cartões (vencem no dia de vencimento de cada cartão);
// - parcelas e contas fixas fora do cartão (tabela compromissos: crédito
//   contratado, poupança do João, contas que se repetem);
// - despesas fixas do Studio e do Espaço (as do mês anterior se repetem
//   no mesmo dia, até serem lançadas no mês).
// Contas fixas que caem no cartão não aparecem sozinhas: já estão dentro da fatura.

import { chaveMes, diasNoMes, lerData, nomeMes, somarMeses, type Mes } from "./fatura";
import { noMes, resumoDoMes } from "./painel";
import { chaveDoExtrato } from "./recorrentes";
import type { Cartao, Compromisso, FaturaInformada, FonteRenda, Lancamento, Negocio } from "./tipos";

export type TipoConta = "fatura" | "parcela" | "negocio";
export type Faixa = "vencidas" | "hoje" | "semana" | "mes";

export type ContaDoCalendario = {
  chave: string;
  tipo: TipoConta;
  nome: string;
  detalhe: string; // "fatura de novembro", "parcela 8 de 18", "Studio Pilates"
  valor: number; // o que falta pagar (ou o que foi pago, se paga)
  vence: string; // AAAA-MM-DD
  semDia: boolean; // conta sem dia marcado: vale o último dia do mês
  paga: boolean;
  mes: Mes;
  cartao?: Cartao;
  compromisso?: Compromisso;
  negocio?: Negocio;
  modelo?: Lancamento; // despesa fixa do mês anterior, usada para lançar a deste mês
  pagamentos?: Lancamento[]; // lançamentos que pagaram a conta no mês
};

type DadosCalendario = {
  lancamentos: Lancamento[];
  lancamentosNegocios: Lancamento[];
  cartoes: Cartao[];
  fontes: FonteRenda[];
  faturasInformadas: FaturaInformada[];
  compromissos: Compromisso[];
  negocios: Negocio[];
};

/** Quantos dias para trás e para frente o calendário olha. */
export const JANELA = 30;

const r2 = (v: number) => Math.round(v * 100) / 100;

function dataNoMes(m: Mes, dia: number | null): string {
  const d = Math.min(dia || diasNoMes(m), diasNoMes(m));
  return `${chaveMes(m)}-${String(d).padStart(2, "0")}`;
}

/** Diferença em dias entre duas datas AAAA-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  const t = (iso: string) => {
    const d = lerData(iso);
    return Date.UTC(d.ano, d.mes - 1, d.dia);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Em qual faixa a conta cai. null = fora da janela (longe demais, para trás ou para frente). */
export function faixaDe(vence: string, hoje: string): Faixa | null {
  const d = diasEntre(hoje, vence);
  if (d < -JANELA || d > JANELA) return null;
  if (d < 0) return "vencidas";
  if (d === 0) return "hoje";
  if (d <= 7) return "semana";
  return "mes";
}

/** Chave que identifica uma despesa fixa de um mês para o outro. */
function chaveFixa(l: Lancamento): string {
  return chaveDoExtrato(l.descricao) || `cat:${l.categoria_id ?? ""}`;
}

/** Despesas fixas do negócio no mês, por chave (a última de cada uma). */
function fixasDoMes(lancs: Lancamento[], m: Mes): Map<string, Lancamento[]> {
  const mapa = new Map<string, Lancamento[]>();
  for (const l of lancs) {
    if (l.tipo !== "saida" || l.grupo !== "fixa" || !noMes(l.data, m)) continue;
    const k = chaveFixa(l);
    mapa.set(k, [...(mapa.get(k) ?? []), l]);
  }
  return mapa;
}

/** Todas as contas dos meses em volta de hoje (mês passado, este e o próximo), pagas ou não. */
export function contasDoCalendario(dados: DadosCalendario, hoje: string): ContaDoCalendario[] {
  const h = lerData(hoje);
  const mesHoje: Mes = { ano: h.ano, mes: h.mes };
  const meses = [-1, 0, 1].map((n) => somarMeses(mesHoje, n));
  const contas: ContaDoCalendario[] = [];

  for (const m of meses) {
    const r = resumoDoMes(m, { ...dados, hoje });

    // faturas dos cartões
    for (const f of r.itensFatura) {
      const inf = dados.faturasInformadas.find((x) => x.cartao_id === f.cartao.id && x.mes === chaveMes(m));
      const paga = !!inf?.paga_em;
      if (f.valor <= 0 && !paga) continue;
      contas.push({
        chave: `fatura:${f.cartao.id}:${chaveMes(m)}`,
        tipo: "fatura",
        nome: `Fatura ${f.cartao.nome}`,
        detalhe: `fatura de ${nomeMes(m)}${f.informado === null ? " (prevista)" : ""}`,
        valor: f.valor,
        vence: dataNoMes(m, f.cartao.dia_vencimento),
        semDia: false,
        paga,
        mes: m,
        cartao: f.cartao,
      });
    }

    // parcelas e contas fixas fora do cartão
    for (const c of r.itensCompromisso) {
      const paga = c.falta <= 0;
      contas.push({
        chave: `parcela:${c.compromisso.id}:${chaveMes(m)}`,
        tipo: "parcela",
        nome: c.compromisso.nome,
        detalhe: c.rotulo,
        valor: paga ? c.pago : c.falta,
        vence: dataNoMes(m, c.compromisso.dia_vencimento),
        semDia: !c.compromisso.dia_vencimento,
        paga,
        mes: m,
        compromisso: c.compromisso,
        pagamentos: dados.lancamentos.filter((l) => l.compromisso_id === c.compromisso.id && noMes(l.data, m)),
      });
    }
  }

  // despesas fixas do Studio e do Espaço
  for (const n of dados.negocios) {
    if (!n.ativo || n.so_marcacao) continue;
    const lancs = dados.lancamentosNegocios.filter((l) => l.negocio_id === n.id);
    for (const m of meses) {
      const deste = fixasDoMes(lancs, m);
      const anterior = fixasDoMes(lancs, somarMeses(m, -1));
      // o mês anterior pode ainda não estar todo lançado: completa com o de dois meses atrás
      for (const [k, ls] of fixasDoMes(lancs, somarMeses(m, -2))) if (!anterior.has(k)) anterior.set(k, ls);
      const chaves = new Set([...deste.keys(), ...anterior.keys()]);
      for (const k of chaves) {
        const feitas = deste.get(k);
        const modelo = (anterior.get(k) ?? feitas)!.at(-1)!;
        const base = feitas ?? anterior.get(k)!;
        contas.push({
          chave: `negocio:${n.id}:${k}:${chaveMes(m)}`,
          tipo: "negocio",
          nome: modelo.descricao || "Despesa fixa",
          detalhe: n.nome,
          valor: r2(base.reduce((s, l) => s + Number(l.valor), 0)),
          vence: feitas ? feitas.at(-1)!.data : dataNoMes(m, lerData(modelo.data).dia),
          semDia: false,
          paga: !!feitas,
          mes: m,
          negocio: n,
          modelo,
          pagamentos: feitas,
        });
      }
    }
  }

  return contas.sort((a, b) => a.vence.localeCompare(b.vence) || a.nome.localeCompare(b.nome));
}

export type Calendario = Record<Faixa, ContaDoCalendario[]> & {
  pagas: ContaDoCalendario[]; // pagas com vencimento neste mês
  totais: Record<Faixa, number>;
};

/** Separa as contas por prazo. As pagas ficam à parte (só as deste mês). */
export function calendario(dados: DadosCalendario, hoje: string): Calendario {
  const cal: Calendario = { vencidas: [], hoje: [], semana: [], mes: [], pagas: [], totais: { vencidas: 0, hoje: 0, semana: 0, mes: 0 } };
  const h = lerData(hoje);
  for (const c of contasDoCalendario(dados, hoje)) {
    if (c.paga) {
      if (noMes(c.vence, { ano: h.ano, mes: h.mes })) cal.pagas.push(c);
      continue;
    }
    const f = faixaDe(c.vence, hoje);
    if (!f) continue;
    cal[f].push(c);
    cal.totais[f] = r2(cal.totais[f] + c.valor);
  }
  return cal;
}
