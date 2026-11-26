// Aviso de lançamento repetido: quando Diego ou Jô lançam algo que parece já lançado
// (mesmo valor, descrição parecida, poucos dias), o app pergunta antes de salvar.
// Usado na tela de lançar e no WhatsApp. Não bloqueia: a compra pode ter sido feita duas vezes.

import { dataCurta, reais } from "./formato";
import type { Lancamento } from "./tipos";

/** Quantos dias para trás procurar um lançamento parecido. */
export const DIAS_REPETIDO = 3;

type Candidato = Pick<Lancamento, "tipo" | "valor" | "data" | "descricao" | "criado_por" | "criado_em"> & { id?: string };
type Novo = Pick<Lancamento, "tipo" | "valor" | "data" | "descricao"> & { id?: string };

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "na", "no", "nas", "nos", "em", "para", "pra", "com", "the", "e", "a", "o"]);

function palavras(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((p) => p.length >= 3 && !PALAVRAS_VAZIAS.has(p) && !/^\d+$/.test(p));
}

/** "Pizza escola" e "pizza na escola" são parecidas; "Pizza" e "Mercado" não. Sem descrição conta como parecida. */
export function descricoesParecidas(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = palavras(a);
  const pb = palavras(b);
  if (!pa.length || !pb.length) return true;
  return pa.some((x) => pb.some((y) => x === y || (x.length >= 4 && y.startsWith(x)) || (y.length >= 4 && x.startsWith(y))));
}

const diasEntre = (a: string, b: string) => Math.abs(Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86400000;

/** O lançamento mais recente que parece ser o mesmo que está sendo lançado agora (ou null). */
export function acharRepetido(novo: Novo, existentes: Candidato[], agora = new Date()): Candidato | null {
  const limite = agora.getTime() - DIAS_REPETIDO * 86400000;
  const achados = existentes.filter(
    (l) =>
      l.id !== novo.id &&
      l.tipo === novo.tipo &&
      Math.abs(Number(l.valor) - Number(novo.valor)) < 0.005 &&
      Date.parse(l.criado_em) >= limite &&
      diasEntre(l.data, novo.data) <= DIAS_REPETIDO &&
      descricoesParecidas(l.descricao, novo.descricao),
  );
  achados.sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em));
  return achados[0] ?? null;
}

const FUSO = "America/Cuiaba";
const diaEmCuiaba = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(d);

/** "hoje às 10h", "ontem às 18h30", "23/11 às 9h" (horário de Cuiabá). */
export function quandoFoi(criadoEm: string, agora = new Date()): string {
  const d = new Date(criadoEm);
  const [h, m] = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(d)
    .split(":")
    .map(Number);
  const hora = `${h}h${m ? String(m).padStart(2, "0") : ""}`;
  const dia = diaEmCuiaba(d);
  const ontem = diaEmCuiaba(new Date(agora.getTime() - 86400000));
  const quando = dia === diaEmCuiaba(agora) ? "hoje" : dia === ontem ? "ontem" : dataCurta(dia);
  return `${quando} às ${hora}`;
}

/** "Jô já lançou Pizza escola R$ 40,00 hoje às 10h. Lançar mesmo assim?" */
export function textoRepetido(l: Candidato, quem: string | null, agora = new Date()): string {
  const autor = quem ?? "Alguém";
  const oque = [l.descricao, reais(Number(l.valor))].filter(Boolean).join(" ");
  return `${autor} já lançou ${oque} ${quandoFoi(l.criado_em, agora)}. Lançar mesmo assim?`;
}
