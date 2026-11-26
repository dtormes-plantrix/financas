// Confere o extrato (ou a fatura) com o que já está lançado no app.
// Cada linha do PDF vira: já lançado, falta lançar, ou fora da conta (pagamento de fatura, rendimento...).

import { chaveDoExtrato } from "../recorrentes";
import type { Cartao, Conta, Dono, FonteRenda, Lancamento } from "../tipos";
import { ehPagamentoDeFatura, type ArquivoLido, type Banco, type ItemLido } from "./leitores";

export type Destino = { tipo: "conta" | "cartao"; id: string };

export type NovoLancamento = Omit<Lancamento, "id" | "criado_em">;

export type Linha = {
  item: ItemLido;
  situacao: "lancado" | "falta" | "fora";
  motivo?: string;
  marcado: boolean; // já vem marcado para lançar?
  lancamento?: Lancamento; // o que já estava lançado
  novo?: NovoLancamento; // o que vai ser lançado
};

type Base = {
  contas: Conta[];
  cartoes: Cartao[];
  fontes: FonteRenda[];
  lancamentos: Lancamento[]; // casa e negócios juntos, para não lançar duas vezes
};

const NOME_BANCO: Record<Banco, string | null> = {
  mercado_pago: "mercado pago",
  nubank: "nubank",
  sicredi: "sicredi",
  inter: "inter",
  banco_do_brasil: "brasil",
  outro: null,
};
const simples = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Qual conta ou cartão do app combina com o arquivo (pelo nome do banco). */
export function sugerirDestino(arq: ArquivoLido, base: Pick<Base, "contas" | "cartoes">): Destino | null {
  const nome = NOME_BANCO[arq.banco];
  if (!nome) return null;
  if (arq.tipo === "fatura") {
    const c = base.cartoes.find((x) => x.ativo !== false && simples(x.nome).includes(nome));
    return c ? { tipo: "cartao", id: c.id } : null;
  }
  const c = base.contas.find((x) => x.ativo !== false && simples(x.nome).includes(nome));
  return c ? { tipo: "conta", id: c.id } : null;
}

// Pix entre o casal: pelo nome ou pelo CPF que aparece no extrato.
const DO_DIEGO = /DIEGO\s+TORMES|85523968153/i;
const DA_JO = /JOANICE|00600575136/i;

// sobrenome da família aparece em todo Pix dos filhos; não serve para reconhecer renda
const SOBRENOMES = new Set(["soletti", "tormes"]);

const dias = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
const centavos = (v: number) => Math.round(v * 100) / 100;

export function conciliar(arq: ArquivoLido, destino: Destino, base: Base): Linha[] {
  const conta = destino.tipo === "conta" ? base.contas.find((c) => c.id === destino.id) : undefined;
  const cartao = destino.tipo === "cartao" ? base.cartoes.find((c) => c.id === destino.id) : undefined;
  const dono: Dono = conta?.dono ?? cartao?.dono ?? "casa";
  const usados = new Set<string>();
  // do mais novo para o mais antigo, para o "aprender com o histórico" pegar o jeito mais recente
  const historico = [...base.lancamentos].sort((a, b) => b.data.localeCompare(a.data));

  const contaDe = (quem: Dono) => base.contas.find((c) => c.ativo !== false && c.dono === quem && c.id !== conta?.id);

  // códigos de transação do banco (OFX) que já estão no app
  const porIdBanco = new Map<string, Lancamento>();
  for (const l of base.lancamentos) if (l.id_banco) porIdBanco.set(l.id_banco, l);
  const reservados = new Set<string>();
  for (const i of arq.itens) {
    const l = i.idBanco ? porIdBanco.get(i.idBanco) : undefined;
    if (l) reservados.add(l.id);
  }

  function procurar(item: ItemLido): Lancamento | undefined {
    if (item.idBanco) {
      const mesmo = porIdBanco.get(item.idBanco);
      if (mesmo) return mesmo; // já importado deste mesmo arquivo (ou de outro com a mesma transação)
    }
    let melhor: Lancamento | undefined;
    let menor = Infinity;
    for (const l of base.lancamentos) {
      if (usados.has(l.id)) continue;
      if (reservados.has(l.id)) continue; // é de outra linha deste arquivo (mesmo código do banco)
      let bate = false;
      let limiteDias = 4;
      if (cartao) {
        if (item.sinal !== "sai" || l.tipo !== "saida" || l.forma !== "credito" || l.cartao_id !== cartao.id) continue;
        if (item.parcela) {
          const n = item.parcela.de;
          bate = l.parcelas === n && Math.abs(l.valor - item.valor * n) <= 0.01 * n + 0.02;
          limiteDias = 40; // cada banco mostra a data da parcela de um jeito
        } else {
          bate = (l.parcelas ?? 1) <= 1 && Math.abs(l.valor - item.valor) < 0.011;
        }
      } else if (conta) {
        if (Math.abs(l.valor - item.valor) >= 0.011 || l.forma === "credito" || (l.forma === "dinheiro" && !l.conta_id)) continue;
        if (item.sinal === "entra") {
          bate = (l.tipo === "entrada" && (l.conta_id === conta.id || !l.conta_id)) || (l.tipo === "transferencia" && l.conta_destino_id === conta.id);
        } else {
          bate = (l.tipo === "saida" && (l.conta_id === conta.id || !l.conta_id)) || (l.tipo === "transferencia" && l.conta_id === conta.id);
        }
      }
      if (!bate) continue;
      const d = dias(l.data, item.data) + (l.conta_id || l.cartao_id ? 0 : 0.5); // prefere o que tem a conta certa
      if (d <= limiteDias + 0.5 && d < menor) {
        menor = d;
        melhor = l;
      }
    }
    return melhor;
  }

  /** Categoria e renda do último lançamento com o mesmo texto do banco. */
  function doHistorico(item: ItemLido, tipo: Lancamento["tipo"]) {
    const chave = chaveDoExtrato(item.descricao);
    if (!chave) return undefined;
    return historico.find((l) => l.tipo === tipo && chaveDoExtrato(l.descricao) === chave && (l.categoria_id || l.fonte_id));
  }

  function fonteProvavel(item: ItemLido): string | null {
    const texto = simples(item.original);
    const f = base.fontes.find(
      (x) => x.ativo !== false && simples(x.nome).split(/\s+/).some((p) => p.length >= 4 && !SOBRENOMES.has(p) && texto.includes(p)),
    );
    return f?.id ?? null;
  }

  return arq.itens.map((item): Linha => {
    // ---- o que não entra na conta ----
    if (arq.tipo === "fatura") {
      if (ehPagamentoDeFatura(item)) return { item, situacao: "fora", motivo: "Pagamento da fatura", marcado: false };
      if (item.sinal === "entra") return { item, situacao: "fora", motivo: "Crédito ou estorno na fatura", marcado: false };
    } else {
      if (/^Rendimentos?$/i.test(item.original.trim())) return { item, situacao: "fora", motivo: "Rendimento da conta", marcado: false };
      if (item.sinal === "sai" && /fatura/i.test(item.original))
        return { item, situacao: "fora", motivo: "Pagamento de fatura do cartão (as compras vêm pela fatura)", marcado: false };
    }

    // ---- já está lançado? ----
    const achado = procurar(item);
    if (achado) {
      usados.add(achado.id);
      return { item, situacao: "lancado", lancamento: achado, marcado: false };
    }

    // ---- falta lançar: monta o lançamento ----
    if (cartao) {
      const n = item.parcela?.de ?? 1;
      const hist = doHistorico(item, "saida");
      return {
        item,
        situacao: "falta",
        marcado: true,
        motivo: item.parcela ? `Parcela ${item.parcela.numero} de ${n}: entra a compra inteira, para as próximas faturas saírem certas` : undefined,
        novo: {
          tipo: "saida",
          valor: centavos(item.valor * n),
          data: item.data,
          descricao: item.descricao,
          forma: "credito",
          conta_id: null,
          cartao_id: cartao.id,
          parcelas: n,
          fonte_id: null,
          categoria_id: hist?.categoria_id ?? null,
          de_quem: cartao.dono,
          criado_por: null,
          ...(item.idBanco ? { id_banco: item.idBanco } : {}),
        },
      };
    }

    const forma = /pix/i.test(item.original) ? "pix" : "debito";
    const base0 = {
      valor: item.valor,
      data: item.data,
      descricao: item.descricao,
      forma,
      cartao_id: null,
      parcelas: 1,
      categoria_id: null,
      de_quem: dono,
      criado_por: null,
      ...(item.idBanco ? { id_banco: item.idBanco } : {}),
    } as const;

    // Pix entre o Diego e a Jô: é "entre contas", não é gasto nem renda.
    const outro: Dono | null = dono === "diego" && DA_JO.test(item.original) ? "jo" : dono === "jo" && DO_DIEGO.test(item.original) ? "diego" : null;
    const contaOutro = outro ? contaDe(outro) : undefined;
    if (outro && contaOutro && conta) {
      const sai = item.sinal === "sai";
      return {
        item,
        situacao: "falta",
        marcado: true,
        motivo: "Pix entre vocês: entra como Entre contas",
        novo: {
          ...base0,
          tipo: "transferencia",
          forma: "pix",
          descricao: sai ? (dono === "diego" ? "Do Diego para a Jô" : "Da Jô para o Diego") : dono === "diego" ? "Da Jô para o Diego" : "Do Diego para a Jô",
          conta_id: sai ? conta.id : contaOutro.id,
          conta_destino_id: sai ? contaOutro.id : conta.id,
          fonte_id: null,
          de_quem: sai ? dono : outro,
        },
      };
    }
    // Pix da pessoa para ela mesma (outra conta dela, fora do app)
    const proprio = (dono === "jo" && DA_JO.test(item.original)) || (dono === "diego" && DO_DIEGO.test(item.original));

    const tipo = item.sinal === "entra" ? "entrada" : "saida";
    const hist = doHistorico(item, tipo);
    return {
      item,
      situacao: "falta",
      marcado: !proprio,
      motivo: proprio ? "Pix da própria pessoa (outra conta dela). Marque se quiser lançar." : undefined,
      novo: {
        ...base0,
        tipo,
        conta_id: conta?.id ?? null,
        fonte_id: tipo === "entrada" ? hist?.fonte_id ?? fonteProvavel(item) : null,
        categoria_id: hist?.categoria_id ?? null,
      },
    };
  });
}
