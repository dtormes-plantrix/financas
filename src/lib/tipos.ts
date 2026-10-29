export type Dono = "diego" | "jo" | "casa";
export type Forma = "pix" | "debito" | "dinheiro" | "credito";
export type TipoLancamento = "entrada" | "saida";

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
  dia_previsto: number | null;
  conta_id: string | null;
  ativo: boolean;
};

export type Categoria = { id: string; nome: string };

export type Lancamento = {
  id: string;
  tipo: TipoLancamento;
  valor: number;
  data: string; // AAAA-MM-DD
  descricao: string | null;
  forma: Forma;
  conta_id: string | null;
  cartao_id: string | null;
  parcelas: number;
  fonte_id: string | null;
  categoria_id: string | null;
  de_quem: Dono;
  compromisso_id?: string | null;
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
  ativo: boolean;
};
