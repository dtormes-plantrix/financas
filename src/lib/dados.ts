// Acesso aos dados. Com o Supabase configurado, tudo vai para a nuvem.
// Sem ele, o app roda em modo demonstração, guardando só neste aparelho.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO } from "./demo";
import type {
  Cartao, Categoria, Compromisso, Conta, FaturaInformada, FonteRenda, Lancamento, Membro, Negocio, GrupoCategoria, RegraCategoria,
} from "./tipos";

export type Dados = {
  membros: Membro[];
  contas: Conta[];
  cartoes: Cartao[];
  fontes: FonteRenda[];
  categorias: Categoria[];
  grupos: GrupoCategoria[];
  /** Nome da loja -> categoria, para lançamentos que chegam sem categoria. */
  regras: RegraCategoria[];
  lancamentos: Lancamento[];
  faturasInformadas: FaturaInformada[];
  compromissos: Compromisso[];
  negocios: Negocio[];
  /** Lançamentos do Studio e do Espaço. Ficam fora de `lancamentos`, que é só da casa. */
  lancamentosNegocios: Lancamento[];
  /** Nome do arquivo de atualização do banco que ainda não rodou, se houver. */
  faltaAtualizar?: string | null;
};

type Tabela = "contas" | "cartoes" | "fontes_renda" | "lancamentos" | "faturas_informadas" | "compromissos" | "negocios" | "categorias" | "grupos" | "regras_categoria";

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

const CHAVE_DEMO = "financas-demo-v7";

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
  negocios: "negocios",
  categorias: "categorias",
  grupos: "grupos",
  regras_categoria: "regras",
};

/** Separa os lançamentos da casa dos lançamentos dos negócios. */
function separar(d: Dados): Dados {
  const todos = [...d.lancamentos, ...(d.lancamentosNegocios ?? [])];
  return {
    ...d,
    negocios: d.negocios ?? [],
    regras: d.regras ?? [],
    grupos: [...(d.grupos ?? [])].sort((a, b) => a.ordem - b.ordem),
    categorias: [...d.categorias].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    lancamentos: todos.filter((l) => !l.negocio_id),
    lancamentosNegocios: todos.filter((l) => l.negocio_id),
  };
}

// ---------- operações ----------

export async function carregarTudo(): Promise<Dados> {
  if (modoDemo) return separar(lerDemo());
  const s = supabase();
  const [membros, contas, cartoes, fontes, categorias, lancamentos, faturas, compromissos, transferencias, negocios, grupos, gruposNegocio, recorrentes, regras, marcacao] = await Promise.all([
    s.from("membros").select("*"),
    s.from("contas").select("*").order("nome"),
    s.from("cartoes").select("*").order("nome"),
    s.from("fontes_renda").select("*").order("nome"),
    s.from("categorias").select("*").order("ordem").order("nome"),
    // compras parceladas de até 4 anos atrás ainda podem cair nas faturas atuais
    lerTodosLancamentos(s),
    s.from("faturas_informadas").select("*"),
    s.from("compromissos").select("*").order("nome"),
    s.from("lancamentos").select("conta_destino_id").limit(1),
    s.from("negocios").select("*").order("nome"),
    s.from("grupos").select("*").order("ordem").order("nome"),
    s.from("grupos").select("negocio_id").limit(1),
    s.from("compromissos").select("busca").limit(1),
    s.from("regras_categoria").select("*"),
    s.from("negocios").select("so_marcacao").limit(1),
  ]);
  // Se uma atualização do banco ainda não rodou, o app continua funcionando e avisa em Ajustes.
  const faltaAtualizar = compromissos.error
    ? "0002_limites_e_parcelas.sql"
    : transferencias.error
      ? "0003_transferencias.sql"
      : negocios.error
        ? "0004_negocios.sql"
        : grupos.error
          ? "0005_grupos_e_categorias.sql"
          : gruposNegocio.error
            ? "0006_categorias_dos_negocios.sql"
            : recorrentes.error
              ? "0007_contas_que_se_repetem.sql"
              : regras.error
                ? "0008_orcamento_por_categoria.sql"
                : marcacao.error
                  ? "0009_plantrix.sql"
                  : null;
  const erro = [membros, contas, cartoes, fontes, categorias, lancamentos, faturas].find((r) => r.error);
  if (erro?.error) throw new Error(erro.error.message);
  return separar({
    membros: membros.data as Membro[],
    contas: contas.data as Conta[],
    cartoes: cartoes.data as Cartao[],
    fontes: fontes.data as FonteRenda[],
    categorias: (categorias.data as Categoria[]).map((c) => ({ ...c, orcamento: c.orcamento == null ? null : Number(c.orcamento) })),
    lancamentos: (lancamentos.data as Lancamento[]).map((l) => ({ ...l, valor: Number(l.valor) })),
    faturasInformadas: faturas.data as FaturaInformada[],
    faltaAtualizar,
    compromissos: ((compromissos.data ?? []) as Compromisso[]).map((c) => ({
      ...c,
      valor: Number(c.valor),
      valor_total: c.valor_total === null ? null : Number(c.valor_total),
    })),
    negocios: (negocios.data ?? []) as Negocio[],
    grupos: (grupos.data ?? []) as GrupoCategoria[],
    regras: (regras.data ?? []) as RegraCategoria[],
    lancamentosNegocios: [],
  });
}

// O Supabase entrega no máximo 1.000 linhas por vez; aqui busca de 1.000 em 1.000 até acabar.
async function lerTodosLancamentos(s: SupabaseClient): Promise<{ data: Lancamento[] | null; error: { message: string } | null }> {
  const pagina = 1000;
  const todos: Lancamento[] = [];
  for (let de = 0; ; de += pagina) {
    const r = await s
      .from("lancamentos")
      .select("*")
      .gte("data", dataLimite())
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false })
      .order("id")
      .range(de, de + pagina - 1);
    if (r.error) return { data: null, error: r.error };
    todos.push(...(r.data as Lancamento[]));
    if (r.data.length < pagina) return { data: todos, error: null };
  }
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

/** Cria um registro novo e devolve o id dele (para já selecionar na tela). */
export async function criar<T extends Registro>(tabela: Tabela, registro: T): Promise<string> {
  const id = crypto.randomUUID();
  if (modoDemo) {
    const d = lerDemo();
    (d[CAMPO_DEMO[tabela]] as unknown as Registro[]).unshift({ ...registro, id, criado_em: new Date().toISOString() });
    gravarDemo(d);
    return id;
  }
  const { error } = await supabase().from(tabela).insert({ ...registro, id });
  if (error) throw new Error(error.message);
  return id;
}

/** Cria vários registros de uma vez (usado na importação do extrato). */
export async function criarVarios<T extends Registro>(tabela: Tabela, registros: T[]): Promise<void> {
  if (!registros.length) return;
  if (modoDemo) {
    const d = lerDemo();
    const lista = d[CAMPO_DEMO[tabela]] as unknown as Registro[];
    for (const r of registros) lista.unshift({ ...r, id: crypto.randomUUID(), criado_em: new Date().toISOString() });
    gravarDemo(d);
    return;
  }
  let lista = registros as unknown as Record<string, unknown>[];
  for (let i = 0; i < lista.length; i += 500) {
    let { error } = await supabase().from(tabela).insert(lista.slice(i, i + 500));
    // banco ainda sem a coluna id_banco (SQL 0012 não rodado): lança mesmo assim, sem o código do banco
    if (error && /id_banco/.test(error.message)) {
      lista = lista.map(({ id_banco: _, ...resto }) => resto);
      ({ error } = await supabase().from(tabela).insert(lista.slice(i, i + 500)));
    }
    if (error) throw new Error(error.message);
  }
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
