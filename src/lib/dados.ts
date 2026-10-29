// Acesso aos dados. Com o Supabase configurado, tudo vai para a nuvem.
// Sem ele, o app roda em modo demonstração, guardando só neste aparelho.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO } from "./demo";
import type {
  Cartao, Categoria, Compromisso, Conta, FaturaInformada, FonteRenda, Lancamento, Membro,
} from "./tipos";

export type Dados = {
  membros: Membro[];
  contas: Conta[];
  cartoes: Cartao[];
  fontes: FonteRenda[];
  categorias: Categoria[];
  lancamentos: Lancamento[];
  faturasInformadas: FaturaInformada[];
  compromissos: Compromisso[];
  bancoDesatualizado?: boolean;
};

type Tabela = "contas" | "cartoes" | "fontes_renda" | "lancamentos" | "faturas_informadas" | "compromissos";

// Tira espaços e aspas que às vezes vêm junto ao colar na Vercel.
const limpar = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
// O Supabase às vezes mostra o endereço com "/rest/v1/" no fim; o app só precisa do começo.
const url = limpar(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const chave = limpar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const modoDemo = !url || !chave;

/** Explica o que está errado na configuração, ou null se estiver tudo certo. */
export function problemaDeConfiguracao(): string | null {
  if (modoDemo) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    return `NEXT_PUBLIC_SUPABASE_URL deveria ser o "Project URL" do Supabase, no formato https://xxxx.supabase.co. Hoje está: "${url.slice(0, 60)}"`;
  }
  if (chave.split(".").length !== 3 && !chave.startsWith("sb_publishable_")) {
    return 'NEXT_PUBLIC_SUPABASE_ANON_KEY deveria ser a chave "anon public" (um texto longo que começa com eyJ) ou a "publishable key" (começa com sb_publishable_).';
  }
  return null;
}

let cliente: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!cliente) cliente = createClient(url, chave);
  return cliente;
}

// ---------- modo demonstração ----------

const CHAVE_DEMO = "financas-demo-v2";

function lerDemo(): Dados {
  try {
    const salvo = localStorage.getItem(CHAVE_DEMO);
    if (salvo) return JSON.parse(salvo);
  } catch {}
  return structuredClone(DEMO);
}

function gravarDemo(d: Dados) {
  try {
    localStorage.setItem(CHAVE_DEMO, JSON.stringify(d));
  } catch {}
}

const CAMPO_DEMO: Record<Tabela, keyof Dados> = {
  contas: "contas",
  cartoes: "cartoes",
  fontes_renda: "fontes",
  lancamentos: "lancamentos",
  faturas_informadas: "faturasInformadas",
  compromissos: "compromissos",
};

// ---------- operações ----------

export async function carregarTudo(): Promise<Dados> {
  if (modoDemo) return lerDemo();
  const s = supabase();
  const [membros, contas, cartoes, fontes, categorias, lancamentos, faturas, compromissos] = await Promise.all([
    s.from("membros").select("*"),
    s.from("contas").select("*").order("nome"),
    s.from("cartoes").select("*").order("nome"),
    s.from("fontes_renda").select("*").order("nome"),
    s.from("categorias").select("*").order("nome"),
    // compras parceladas de até 4 anos atrás ainda podem cair nas faturas atuais
    s.from("lancamentos").select("*").gte("data", dataLimite()).order("data", { ascending: false }).order("criado_em", { ascending: false }),
    s.from("faturas_informadas").select("*"),
    s.from("compromissos").select("*").order("nome"),
  ]);
  // Se a atualização 0002 do banco ainda não rodou, a tabela de parcelas não existe:
  // o app continua funcionando e avisa em Ajustes.
  const bancoDesatualizado = !!compromissos.error;
  const erro = [membros, contas, cartoes, fontes, categorias, lancamentos, faturas].find((r) => r.error);
  if (erro?.error) throw new Error(erro.error.message);
  return {
    membros: membros.data as Membro[],
    contas: contas.data as Conta[],
    cartoes: cartoes.data as Cartao[],
    fontes: fontes.data as FonteRenda[],
    categorias: categorias.data as Categoria[],
    lancamentos: (lancamentos.data as Lancamento[]).map((l) => ({ ...l, valor: Number(l.valor) })),
    faturasInformadas: faturas.data as FaturaInformada[],
    bancoDesatualizado,
    compromissos: ((compromissos.data ?? []) as Compromisso[]).map((c) => ({
      ...c,
      valor: Number(c.valor),
      valor_total: c.valor_total === null ? null : Number(c.valor_total),
    })),
  };
}

function dataLimite(): string {
  const d = new Date();
  return `${d.getFullYear() - 4}-01-01`;
}

/** Cria (sem id) ou atualiza (com id) um registro. */
type Registro = { id?: string; [campo: string]: unknown };

export async function salvar<T extends Registro>(tabela: Tabela, registro: T): Promise<void> {
  if (modoDemo) {
    const d = lerDemo();
    const lista = d[CAMPO_DEMO[tabela]] as unknown as (T & { id: string })[];
    if (registro.id) {
      const i = lista.findIndex((x) => x.id === registro.id);
      if (i >= 0) lista[i] = { ...lista[i], ...registro };
    } else {
      lista.unshift({ ...registro, id: crypto.randomUUID(), criado_em: new Date().toISOString() } as T & { id: string });
    }
    gravarDemo(d);
    return;
  }
  const s = supabase();
  const { id, ...resto } = registro;
  const campos = resto as Record<string, unknown>;
  const { error } = id
    ? await s.from(tabela).update(campos).eq("id", id)
    : await s.from(tabela).insert(campos);
  if (error) throw new Error(error.message);
}

export async function excluir(tabela: Tabela, id: string): Promise<void> {
  if (modoDemo) {
    const d = lerDemo();
    const campo = CAMPO_DEMO[tabela];
    (d[campo] as unknown as { id: string }[]) = (d[campo] as unknown as { id: string }[]).filter((x) => x.id !== id);
    gravarDemo(d);
    return;
  }
  const { error } = await supabase().from(tabela).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Grava o valor da fatura de um mês (ou apaga, se vazio). */
export async function informarFatura(cartaoId: string, mes: string, valor: number | null): Promise<void> {
  if (modoDemo) {
    const d = lerDemo();
    d.faturasInformadas = d.faturasInformadas.filter((f) => !(f.cartao_id === cartaoId && f.mes === mes));
    if (valor) d.faturasInformadas.push({ id: crypto.randomUUID(), cartao_id: cartaoId, mes, valor });
    gravarDemo(d);
    return;
  }
  const s = supabase();
  const { error } = valor
    ? await s.from("faturas_informadas").upsert({ cartao_id: cartaoId, mes, valor }, { onConflict: "cartao_id,mes" })
    : await s.from("faturas_informadas").delete().eq("cartao_id", cartaoId).eq("mes", mes);
  if (error) throw new Error(error.message);
}

export function resetarDemo() {
  try {
    localStorage.removeItem(CHAVE_DEMO);
  } catch {}
}
