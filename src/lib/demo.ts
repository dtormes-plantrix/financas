// Dados de exemplo para o modo demonstração (sem Supabase).
// Contas, cartões e rendas reais; lançamentos inventados só para mostrar as telas.

import type { Dados } from "./dados";

function dia(deslocamento: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const agora = new Date().toISOString();

/** Grupos e categorias sugeridos (os mesmos da atualização 0005 do banco). */
const GRUPOS_PADRAO: [string, string[]][] = [
  ["Casa", ["Mercado", "Contas da casa", "Condomínio", "Manutenção", "Assinaturas", "Eletro e móveis"]],
  ["Filhos", ["Escola", "Esportes", "Mesada"]],
  ["Estilo de vida", ["Bares e restaurantes", "Delivery", "Compras", "Roupas", "Cuidados pessoais", "Lazer", "Viagens", "Presentes"]],
  ["Saúde", ["Farmácia", "Consultas e exames", "Seguros"]],
  ["Transporte", ["Combustível", "Pedágio e estacionamento", "Manutenção do carro", "IPVA e Detran", "Uber e táxi"]],
  ["Educação e trabalho", ["Cursos e MBA", "Ferramentas e softwares"]],
  ["Igreja e doações", ["Dízimo", "Ofertas", "Doações e associações"]],
  ["Banco e dívidas", ["Juros e IOF", "Tarifas", "Empréstimos"]],
  ["Investimentos", ["Previdência", "Poupança"]],
  ["Outros", ["Outros"]],
];

/** Orçamentos por mês (os mesmos da atualização 0008). */
const ORCAMENTOS: Record<string, number> = { Mercado: 2000, "Bares e restaurantes": 500, Delivery: 300 };
const ORCAMENTOS_NEGOCIOS: Record<string, number> = { "Material e limpeza": 200, "Aluguel da sala": 900, "Energia, água e internet": 400 };

/** Grupos sugeridos para os negócios (os mesmos da atualização 0006). */
const GRUPOS_NEGOCIOS: [string, string, string[]][] = [
  ["n-studio", "Entradas", ["Mensalidades", "Aulas avulsas", "Pacotes e planos"]],
  ["n-studio", "Despesas fixas", ["Aluguel da sala", "Energia, água e internet", "Instrutoras", "Contador e impostos", "Sistemas e assinaturas"]],
  ["n-studio", "Despesas variáveis", ["Equipamentos", "Material e limpeza", "Manutenção", "Divulgação", "Cursos"]],
  ["n-espaco", "Entradas", ["Aluguéis", "Locação por hora ou evento"]],
  ["n-espaco", "Despesas fixas", ["Energia, água e internet", "IPTU", "Condomínio", "Contador e impostos"]],
  ["n-espaco", "Despesas variáveis", ["Manutenção", "Reformas", "Limpeza", "Divulgação"]],
];

export const DEMO: Dados = {
  membros: [
    { user_id: "demo-diego", nome: "Diego", apelido: "diego" },
    { user_id: "demo-jo", nome: "Jô", apelido: "jo" },
  ],
  contas: [
    { id: "c-mp", nome: "Mercado Pago", dono: "diego", limite_cheque_especial: null, saldo: 162.04, saldo_atualizado_em: null, ativo: true },
    { id: "c-sicredi", nome: "Sicredi", dono: "jo", limite_cheque_especial: 20000, saldo: -8746.2, saldo_atualizado_em: null, ativo: true },
  ],
  cartoes: [
    { id: "k-mp", nome: "Mercado Pago", dono: "diego", limite: 16000, dia_fechamento: 5, dia_vencimento: 13, conta_pagamento_id: "c-mp", limite_usado: 9525.04, limite_atualizado_em: null, ativo: true },
    { id: "k-sicredi", nome: "Sicredi Visa Gold", dono: "jo", limite: 25000, dia_fechamento: 28, dia_vencimento: 13, conta_pagamento_id: "c-sicredi", limite_usado: 7024.81, limite_atualizado_em: null, ativo: true },
    { id: "k-nubank", nome: "Nubank", dono: "jo", limite: 48316.49, dia_fechamento: 20, dia_vencimento: 27, conta_pagamento_id: null, limite_usado: null, limite_atualizado_em: null, ativo: true },
  ],
  fontes: [
    { id: "f-plantrix", nome: "Plantrix", valor_bruto: 9000, percentual_imposto: 6, descontos_fixos: 0, dia_previsto: null, conta_id: "c-mp", ativo: true },
    { id: "f-aluguel", nome: "Aluguel", valor_bruto: 8692.33, percentual_imposto: 0, descontos_fixos: 0, dia_previsto: 20, conta_id: "c-sicredi", ativo: true },
    { id: "f-sady", nome: "Ajuda do Sady", valor_bruto: 10638, percentual_imposto: 0, descontos_fixos: 0, dia_previsto: 5, conta_id: "c-sicredi", ativo: true },
    { id: "f-espaco", nome: "Espaço Soletti", valor_bruto: null, percentual_imposto: 0, descontos_fixos: 0, dia_previsto: null, conta_id: "c-sicredi", ativo: true },
    { id: "f-studio", nome: "Studio Pilates", valor_bruto: null, percentual_imposto: 0, descontos_fixos: 0, dia_previsto: null, conta_id: "c-sicredi", ativo: true },
  ],
  grupos: [
    ...GRUPOS_PADRAO.map(([nome], i) => ({ id: `g-${i}`, nome, ordem: i + 1, negocio_id: null })),
    ...GRUPOS_NEGOCIOS.map(([negocio, nome], i) => ({ id: `gn-${i}`, nome, ordem: i + 1, negocio_id: negocio })),
  ],
  categorias: [
    ...GRUPOS_PADRAO.flatMap(([, cats], i) =>
      cats.map((nome, j) => ({ id: `cat-${i}-${j}`, nome, grupo_id: `g-${i}`, ordem: j + 1, orcamento: ORCAMENTOS[nome] ?? null })),
    ),
    ...GRUPOS_NEGOCIOS.flatMap(([, , cats], i) =>
      cats.map((nome, j) => ({ id: `catn-${i}-${j}`, nome, grupo_id: `gn-${i}`, ordem: j + 1, orcamento: i === 0 ? null : ORCAMENTOS_NEGOCIOS[nome] ?? null })),
    ),
  ],
  regras: [
    { id: "r1", busca: "comper", categoria_id: "cat-0-0" },
    { id: "r2", busca: "supermercado", categoria_id: "cat-0-0" },
    { id: "r3", busca: "ifood", categoria_id: "cat-2-1" },
    { id: "r4", busca: "pizz", categoria_id: "cat-2-0" },
  ],
  lancamentos: [
    { id: "l6", tipo: "saida", valor: 312.4, data: dia(-2), descricao: "Supermercado SCS", forma: "credito", conta_id: null, cartao_id: "k-sicredi", parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: null, criado_em: agora },
    { id: "l7", tipo: "saida", valor: 86.9, data: dia(-1), descricao: "iFood", forma: "credito", conta_id: null, cartao_id: "k-nubank", parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: null, criado_em: agora },
    { id: "l8", tipo: "saida", valor: 214, data: dia(-3), descricao: "Cervejaria Louvada", forma: "credito", conta_id: null, cartao_id: "k-mp", parcelas: 1, fonte_id: null, categoria_id: "cat-2-0", de_quem: "diego", criado_por: "demo-diego", criado_em: agora },
    { id: "l9", tipo: "saida", valor: 132, data: dia(-4), descricao: "Pizzaria", forma: "credito", conta_id: null, cartao_id: "k-mp", parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "diego", criado_por: null, criado_em: agora },
    { id: "l10", tipo: "saida", valor: 129, data: dia(-5), descricao: "iFood", forma: "credito", conta_id: null, cartao_id: "k-nubank", parcelas: 1, fonte_id: null, categoria_id: "cat-2-1", de_quem: "jo", criado_por: "demo-jo", criado_em: agora },
    { id: "l1", tipo: "saida", valor: 184.18, data: dia(0), descricao: "Comper", forma: "credito", conta_id: null, cartao_id: "k-nubank", parcelas: 1, fonte_id: null, categoria_id: "cat-0-0", de_quem: "casa", criado_por: "demo-jo", criado_em: agora },
    { id: "l2", tipo: "saida", valor: 48, data: dia(-1), descricao: "Feira", forma: "pix", conta_id: "c-sicredi", cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: "cat-0-0", de_quem: "jo", criado_por: "demo-jo", criado_em: agora },
    { id: "l3", tipo: "saida", valor: 1200, data: dia(-2), descricao: "Geladeira", forma: "credito", conta_id: null, cartao_id: "k-mp", parcelas: 6, fonte_id: null, categoria_id: "cat-0-5", de_quem: "casa", criado_por: "demo-diego", criado_em: agora },
    { id: "l4", tipo: "saida", valor: 622.12, data: dia(-3), descricao: "Águas Cuiabá", forma: "pix", conta_id: "c-sicredi", cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: "cat-0-1", de_quem: "casa", criado_por: "demo-jo", criado_em: agora },
    { id: "l5", tipo: "transferencia", valor: 3000, data: dia(-4), descricao: "Para a conta da Jô", forma: "pix", conta_id: "c-mp", conta_destino_id: "c-sicredi", cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "diego", criado_por: "demo-diego", criado_em: agora },
    { id: "n1", tipo: "entrada", valor: 350, data: dia(0), descricao: "Mensalidade Ana", forma: "pix", conta_id: null, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: "demo-jo", criado_em: agora, negocio_id: "n-studio", grupo: "aluno" },
    { id: "n2", tipo: "entrada", valor: 350, data: dia(-1), descricao: "Mensalidade Carla", forma: "pix", conta_id: null, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: "demo-jo", criado_em: agora, negocio_id: "n-studio", grupo: "aluno" },
    { id: "n3", tipo: "entrada", valor: 280, data: dia(-2), descricao: "Mensalidade Bia", forma: "pix", conta_id: null, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: "demo-jo", criado_em: agora, negocio_id: "n-studio", grupo: "aluno" },
    { id: "n4", tipo: "saida", valor: 900, data: dia(-1), descricao: "Aluguel da sala", forma: "pix", conta_id: null, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: "catn-1-0", de_quem: "jo", criado_por: "demo-jo", criado_em: agora, negocio_id: "n-studio", grupo: "fixa" },
    { id: "n5", tipo: "saida", valor: 120, data: dia(-2), descricao: "Material", forma: "pix", conta_id: null, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: "catn-2-1", de_quem: "jo", criado_por: "demo-jo", criado_em: agora, negocio_id: "n-studio", grupo: "variavel" },
    { id: "n6", tipo: "entrada", valor: 2500, data: dia(-1), descricao: "Aluguel sala 1", forma: "pix", conta_id: null, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: "demo-jo", criado_em: agora, negocio_id: "n-espaco", grupo: "aluguel" },
    { id: "n7", tipo: "saida", valor: 310, data: dia(-2), descricao: "Energia", forma: "pix", conta_id: null, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: "catn-4-0", de_quem: "jo", criado_por: "demo-jo", criado_em: agora, negocio_id: "n-espaco", grupo: "fixa" },
  ],
  faturasInformadas: [],
  negocios: [
    { id: "n-studio", nome: "Studio Pilates", fonte_id: "f-studio", ativo: true },
    { id: "n-espaco", nome: "Espaço Soletti", fonte_id: "f-espaco", ativo: true },
  ],
  lancamentosNegocios: [],
  compromissos: [
    { id: "p-credito", nome: "Crédito contratado", valor: 1014.22, dia_vencimento: 18, mes_inicial: "2026-11", parcela_inicial: 7, total_parcelas: 18, valor_total: null, conta_id: null, ativo: true },
    { id: "p-joao", nome: "Devolver poupança do João", valor: 500, dia_vencimento: null, mes_inicial: "2026-11", parcela_inicial: 1, total_parcelas: null, valor_total: 8500, conta_id: null, ativo: true },
  ],
};
