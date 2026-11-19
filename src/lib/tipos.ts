export type Dono = "diego" | "jo" | "casa";
export type Forma = "pix" | "debito" | "dinheiro" | "credito";
export type TipoLancamento = "entrada" | "saida" | "transferencia";

/** Tipo de lançamento dentro de um negócio. */
export type Grupo = "aluno" | "aluguel" | "fixa" | "variavel" | "outra";

export type Negocio = {
  id: string;
  nome: string;
  fonte_id: string | null; // renda da casa que recebe as sobras
  ativo: boolean;
  // Sem caixa próprio (Plantrix): os gastos ficam na casa e só são marcados como do negócio.
  so_marcacao?: boolean;
  palavras_marcacao?: string[] | null; // ex.: "adobe" — lançamento com essa palavra já vem marcado
};

export type Membro = { user_id: string; nome: string; apelido: Dono };

export type Conta = {
  id: string;
  nome: string;
  dono: Dono;
  limite_cheque_especial: number | null;
  saldo: number | null; // negativo = cheque especial em uso
  saldo_atualizado_em: string | null;
  ativo: boolean;
};

export type Cartao = {
  id: string;
  nome: string;
  dono: Dono;
  limite: number | null;
  dia_fechamento: number;
  dia_vencimento: number;
  conta_pagamento_id: string | null;
  limite_usado: number | null;
  limite_atualizado_em: string | null;
  ativo: boolean;
};

export type FonteRenda = {
  id: string;
  nome: string;
  valor_bruto: number | null;
  percentual_imposto: number;
  descontos_fixos?: number | null; // contabilidade, INSS etc., em reais
  dia_previsto: number | null;
  conta_id: string | null;
  ativo: boolean;
};

export type GrupoCategoria = { id: string; nome: string; ordem: number; negocio_id?: string | null };

export type Categoria = {
  id: string;
  nome: string;
  grupo_id?: string | null;
  ordem?: number;
  orcamento?: number | null; // quanto se quer gastar por mês (vazio = sem orçamento)
};

/** Nome da loja que leva a uma categoria (ex.: "comper" -> Mercado). */
export type RegraCategoria = { id: string; busca: string; categoria_id: string };

export type Lancamento = {
  id: string;
  tipo: TipoLancamento;
  valor: number;
  data: string; // AAAA-MM-DD
  descricao: string | null;
  forma: Forma;
  conta_id: string | null; // na transferência, a conta de onde o dinheiro sai
  conta_destino_id?: string | null; // na transferência, a conta para onde vai
  cartao_id: string | null;
  parcelas: number;
  fonte_id: string | null;
  categoria_id: string | null;
  de_quem: Dono;
  compromisso_id?: string | null;
  negocio_id?: string | null; // lançamento do Studio ou do Espaço: fica fora das contas da casa
  grupo?: Grupo | null;
  marcado_negocio_id?: string | null; // gasto da casa que é da empresa (ex.: Plantrix): continua na casa
  criado_por: string | null;
  criado_em: string;
};

export type FaturaInformada = {
  id: string;
  cartao_id: string;
  mes: string; // AAAA-MM (mês de vencimento)
  valor: number;
};

export type Compromisso = {
  id: string;
  nome: string;
  valor: number;
  dia_vencimento: number | null;
  mes_inicial: string; // AAAA-MM em que vence a parcela_inicial
  parcela_inicial: number;
  total_parcelas: number | null; // null = repete todo mês
  valor_total: number | null; // dívida: termina quando os pagamentos somarem este valor
  conta_id: string | null;
  cartao_id?: string | null; // conta fixa no cartão: entra na fatura prevista
  busca?: string | null; // texto do extrato que identifica o pagamento (ex.: "NETFLIX COM")
  ativo: boolean; // false = sugestão que a pessoa disse que não é conta fixa
};
