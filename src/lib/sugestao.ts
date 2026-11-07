// Sugere a categoria enquanto a pessoa digita a descrição de uma saída.
//
// Junta três pistas:
// 1. a regra de loja que o app já conhece (ex.: "comper" -> Mercado);
// 2. um dicionário de palavras do dia a dia (ex.: "água" -> Bares e restaurantes;
//    "lanche" -> Bares e restaurantes ou Delivery);
// 3. o que vocês já escolheram antes para a mesma palavra (é assim que ele aprende:
//    se "lanche" vira Delivery várias vezes, Delivery passa a vir primeiro).

import { normalizar, regraPara } from "./orcamento";
import type { Categoria, Lancamento, RegraCategoria } from "./tipos";

/** Palavra -> categorias possíveis, da mais provável para a menos. Sem acento. */
export const PALAVRAS: Record<string, string[]> = {
  // bares, lanches, café, sorvete
  agua: ["Bares e restaurantes", "Mercado"],
  refri: ["Bares e restaurantes", "Mercado"],
  refrigerante: ["Bares e restaurantes", "Mercado"],
  cerveja: ["Bares e restaurantes", "Mercado"],
  chopp: ["Bares e restaurantes"],
  chope: ["Bares e restaurantes"],
  suco: ["Bares e restaurantes", "Mercado"],
  cafe: ["Bares e restaurantes", "Mercado"],
  sorvete: ["Bares e restaurantes"],
  picole: ["Bares e restaurantes"],
  acai: ["Bares e restaurantes", "Delivery"],
  pastel: ["Bares e restaurantes"],
  coxinha: ["Bares e restaurantes"],
  salgado: ["Bares e restaurantes"],
  espetinho: ["Bares e restaurantes"],
  bar: ["Bares e restaurantes"],
  restaurante: ["Bares e restaurantes", "Delivery"],
  almoco: ["Bares e restaurantes", "Delivery"],
  janta: ["Bares e restaurantes", "Delivery"],
  jantar: ["Bares e restaurantes", "Delivery"],
  lanche: ["Bares e restaurantes", "Delivery"],
  pizza: ["Bares e restaurantes", "Delivery"],
  hamburguer: ["Bares e restaurantes", "Delivery"],
  burger: ["Bares e restaurantes", "Delivery"],
  sushi: ["Bares e restaurantes", "Delivery"],
  marmita: ["Delivery", "Bares e restaurantes"],
  delivery: ["Delivery"],
  ifood: ["Delivery"],
  // mercado
  mercado: ["Mercado"],
  supermercado: ["Mercado"],
  padaria: ["Mercado"],
  pao: ["Mercado"],
  acougue: ["Mercado"],
  carne: ["Mercado"],
  feira: ["Mercado"],
  verdura: ["Mercado"],
  fruta: ["Mercado"],
  leite: ["Mercado"],
  queijo: ["Mercado"],
  // casa
  luz: ["Contas da casa"],
  energia: ["Contas da casa"],
  internet: ["Contas da casa"],
  gas: ["Contas da casa"],
  condominio: ["Condomínio"],
  diarista: ["Diarista"],
  faxina: ["Diarista"],
  netflix: ["Assinaturas"],
  spotify: ["Assinaturas"],
  assinatura: ["Assinaturas"],
  // transporte
  gasolina: ["Combustível"],
  etanol: ["Combustível"],
  alcool: ["Combustível"],
  diesel: ["Combustível"],
  combustivel: ["Combustível"],
  posto: ["Combustível"],
  uber: ["Uber e táxi"],
  taxi: ["Uber e táxi"],
  estacionamento: ["Pedágio e estacionamento"],
  pedagio: ["Pedágio e estacionamento"],
  oficina: ["Manutenção do carro"],
  mecanico: ["Manutenção do carro"],
  pneu: ["Manutenção do carro"],
  lavagem: ["Manutenção do carro"],
  // saúde e cuidados
  farmacia: ["Farmácia"],
  drogaria: ["Farmácia"],
  remedio: ["Farmácia"],
  consulta: ["Consultas e exames"],
  exame: ["Consultas e exames"],
  medico: ["Consultas e exames"],
  dentista: ["Consultas e exames"],
  cabelo: ["Cuidados pessoais"],
  salao: ["Cuidados pessoais"],
  barbearia: ["Cuidados pessoais"],
  barbeiro: ["Cuidados pessoais"],
  unha: ["Cuidados pessoais"],
  manicure: ["Cuidados pessoais"],
  esteticista: ["Cuidados pessoais"],
  // estilo de vida
  roupa: ["Roupas"],
  camisa: ["Roupas"],
  camiseta: ["Roupas"],
  tenis: ["Roupas"],
  sapato: ["Roupas"],
  cinema: ["Lazer"],
  show: ["Lazer"],
  ingresso: ["Lazer"],
  presente: ["Presentes"],
  viagem: ["Viagens"],
  hotel: ["Viagens"],
  passagem: ["Viagens"],
  // filhos, igreja
  escola: ["Escola"],
  mesada: ["Mesada"],
  dizimo: ["Dízimo"],
  oferta: ["Ofertas"],
};

/** Palavras da descrição, sem acento e sem números. */
function palavras(texto: string | null | undefined): string[] {
  return normalizar(texto)
    .replace(/[^a-z\s]/g, " ")
    .split(" ")
    .filter((p) => p.length >= 3);
}

/** "lan" (ainda digitando) combina com "lanche"; "lanches" também combina. */
function combina(digitada: string, chave: string): boolean {
  return digitada === chave || chave.startsWith(digitada) || (chave.length >= 4 && digitada.startsWith(chave));
}

/** Palavras do dicionário que estão na descrição (só palavras inteiras ou plural). */
function palavrasDoDicionario(descricao: string | null | undefined, inteiras = false): string[] {
  const achadas: string[] = [];
  for (const p of palavras(descricao)) {
    for (const chave of Object.keys(PALAVRAS)) {
      const ok = inteiras ? p === chave || p === chave + "s" : combina(p, chave);
      if (ok && !achadas.includes(chave)) achadas.push(chave);
    }
  }
  return achadas;
}

/**
 * Descrição genérica que pode ser de mais de uma categoria (ex.: "lanche").
 * Essas não viram regra de loja, senão uma escolha passaria a valer para todas.
 */
export function descricaoAmbigua(descricao: string | null | undefined): boolean {
  return palavrasDoDicionario(descricao, true).some((c) => PALAVRAS[c].length > 1);
}

/**
 * Até `max` categorias (ids) para a descrição, da mais provável para a menos.
 * `categorias` deve ter só as da casa.
 */
export function sugerirCategorias(
  descricao: string | null | undefined,
  categorias: Categoria[],
  regras: RegraCategoria[],
  lancamentos: Lancamento[],
  max = 3,
): string[] {
  const digitadas = palavras(descricao);
  if (!digitadas.length) return [];
  const daCasa = new Set(categorias.map((c) => c.id));
  const porNome = new Map(categorias.map((c) => [normalizar(c.nome), c.id]));
  const pontos = new Map<string, number>();
  const somar = (id: string | undefined, p: number) => {
    if (id && daCasa.has(id)) pontos.set(id, (pontos.get(id) ?? 0) + p);
  };

  // 1. loja conhecida
  somar(regraPara(descricao, regras)?.categoria_id, 30);

  // 2. dicionário: a primeira opção vale mais que a segunda
  for (const chave of palavrasDoDicionario(descricao)) {
    PALAVRAS[chave].forEach((nome, i) => somar(porNome.get(normalizar(nome)), 40 - i * 5));
  }

  // 3. o que já foi escolhido antes para a mesma palavra (até 4 vezes contam)
  const usos = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.tipo !== "saida" || !l.categoria_id || l.negocio_id) continue;
    const doLancamento = palavras(l.descricao);
    if (digitadas.some((d) => doLancamento.some((p) => combina(d, p)))) {
      usos.set(l.categoria_id, (usos.get(l.categoria_id) ?? 0) + 1);
    }
  }
  usos.forEach((n, id) => somar(id, Math.min(n, 4) * 15));

  return [...pontos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([id]) => id);
}
