// Dados de exemplo para o modo demonstração (sem Supabase).
// Contas, cartões e rendas reais; lançamentos inventados só para mostrar as telas.

import type { Dados } from "./dados";

function dia(deslocamento: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const agora = new Date().toISOString();

export const DEMO: Dados = {
  membros: [
    { user_id: "demo-diego", nome: "Diego", apelido: "diego" },
    { user_id: "demo-jo", nome: "Jô", apelido: "jo" },
  ],
  contas: [
    { id: "c-mp", nome: "Mercado Pago", dono: "diego", limite_cheque_especial: null, ativo: true },
    { id: "c-sicredi", nome: "Sicredi", dono: "jo", limite_cheque_especial: 20000, ativo: true },
  ],
  cartoes: [
    { id: "k-mp", nome: "Mercado Pago", dono: "diego", limite: 16000, dia_fechamento: 5, dia_vencimento: 13, conta_pagamento_id: "c-mp", ativo: true },
    { id: "k-sicredi", nome: "Sicredi Visa Gold", dono: "jo", limite: 25000, dia_fechamento: 28, dia_vencimento: 13, conta_pagamento_id: "c-sicredi", ativo: true },
    { id: "k-nubank", nome: "Nubank", dono: "jo", limite: 48316.49, dia_fechamento: 20, dia_vencimento: 27, conta_pagamento_id: null, ativo: true },
  ],
  fontes: [
    { id: "f-plantrix", nome: "Plantrix", valor_bruto: 9000, percentual_imposto: 6, dia_previsto: null, conta_id: "c-mp", ativo: true },
    { id: "f-aluguel", nome: "Aluguel", valor_bruto: 8692.33, percentual_imposto: 0, dia_previsto: 20, conta_id: "c-sicredi", ativo: true },
    { id: "f-sady", nome: "Ajuda do Sady", valor_bruto: 10638, percentual_imposto: 0, dia_previsto: 5, conta_id: "c-sicredi", ativo: true },
    { id: "f-studio", nome: "Studio Pilates", valor_bruto: null, percentual_imposto: 0, dia_previsto: null, conta_id: "c-sicredi", ativo: true },
  ],
  categorias: [
    "Mercado", "Casa", "Contas fixas", "Saúde", "Educação", "Transporte",
    "Restaurante e delivery", "Lazer", "Roupas", "Assinaturas", "Outros",
  ].map((nome, i) => ({ id: `cat-${i}`, nome })),
  lancamentos: [
    { id: "l1", tipo: "saida", valor: 184.18, data: dia(0), descricao: "Comper", forma: "credito", conta_id: null, cartao_id: "k-nubank", parcelas: 1, fonte_id: null, categoria_id: "cat-0", de_quem: "casa", criado_por: "demo-jo", criado_em: agora },
    { id: "l2", tipo: "saida", valor: 48, data: dia(-1), descricao: "Feira", forma: "pix", conta_id: "c-sicredi", cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: "cat-0", de_quem: "jo", criado_por: "demo-jo", criado_em: agora },
    { id: "l3", tipo: "saida", valor: 1200, data: dia(-2), descricao: "Geladeira", forma: "credito", conta_id: null, cartao_id: "k-mp", parcelas: 6, fonte_id: null, categoria_id: "cat-1", de_quem: "casa", criado_por: "demo-diego", criado_em: agora },
    { id: "l4", tipo: "saida", valor: 622.12, data: dia(-3), descricao: "Águas Cuiabá", forma: "pix", conta_id: "c-sicredi", cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: "cat-2", de_quem: "casa", criado_por: "demo-jo", criado_em: agora },
  ],
  faturasInformadas: [],
};
