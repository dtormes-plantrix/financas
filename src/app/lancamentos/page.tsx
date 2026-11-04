"use client";

// Extrato: todos os lançamentos da casa, inclusive os que vieram dos extratos em PDF.
// Toque num lançamento para editar ou apagar.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { ParcelasDoMes } from "@/components/Parcelas";
import { useSessao } from "@/components/Sessao";
import { nomeMes, somarMeses, type Mes } from "@/lib/fatura";
import { dataCurta, NOME_DONO, NOME_FORMA, reais } from "@/lib/formato";
import { noMes } from "@/lib/painel";
import type { Dono, Forma, Lancamento, TipoLancamento } from "@/lib/tipos";

type Filtros = {
  mes: Mes;
  todosOsMeses: boolean;
  busca: string;
  tipo: TipoLancamento | "todos";
  pessoa: Dono | "todos";
  forma: Forma | "todas";
  onde: string; // "" = todas, "conta:<id>" ou "cartao:<id>"
  categoria: string; // "" = todas, "sem" = sem categoria, ou o id
};

const CHAVE = "financas-extrato-filtros";

function filtrosIniciais(): Filtros {
  const d = new Date();
  const padrao: Filtros = {
    mes: { ano: d.getFullYear(), mes: d.getMonth() + 1 },
    todosOsMeses: false,
    busca: "",
    tipo: "todos",
    pessoa: "todos",
    forma: "todas",
    onde: "",
    categoria: "",
  };
  try {
    const salvo = sessionStorage.getItem(CHAVE);
    if (salvo) return { ...padrao, ...JSON.parse(salvo) };
  } catch {}
  return padrao;
}

/** Tira acentos e deixa minúsculo, para a busca achar "agua" em "Águas". */
const simples = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Extrato() {
  const { dados } = useSessao();
  const [f, setF] = useState<Filtros>(filtrosIniciais);
  const [abrirFiltros, setAbrirFiltros] = useState(false);
  const mudar = (parte: Partial<Filtros>) => setF((atual) => ({ ...atual, ...parte }));

  // Guarda os filtros para voltar do mesmo jeito depois de editar um lançamento.
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(f));
    } catch {}
  }, [f]);

  const nome = (id: string | null | undefined, de: { id: string; nome: string }[]) => de.find((x) => x.id === id)?.nome;
  const titulo = (l: Lancamento) =>
    l.descricao || nome(l.fonte_id, dados.fontes) || nome(l.categoria_id, dados.categorias) ||
    (l.tipo === "entrada" ? "Entrada" : l.tipo === "transferencia" ? "Entre contas" : "Saída");

  const termo = simples(f.busca.trim());
  const lista = dados.lancamentos.filter((l) => {
    if (!f.todosOsMeses && !noMes(l.data, f.mes)) return false;
    if (f.tipo !== "todos" && l.tipo !== f.tipo) return false;
    if (f.pessoa !== "todos" && l.de_quem !== f.pessoa) return false;
    if (f.forma !== "todas" && (l.forma !== f.forma || l.tipo === "transferencia")) return false;
    if (f.onde) {
      const [qual, id] = f.onde.split(":");
      const bate = qual === "cartao" ? l.cartao_id === id : l.conta_id === id || l.conta_destino_id === id;
      if (!bate) return false;
    }
    if (f.categoria === "sem" && (l.categoria_id || l.tipo !== "saida")) return false;
    if (f.categoria && f.categoria !== "sem" && l.categoria_id !== f.categoria) return false;
    if (termo) {
      const texto = simples(
        [titulo(l), nome(l.categoria_id, dados.categorias), nome(l.fonte_id, dados.fontes), reais(l.valor), String(l.valor).replace(".", ",")]
          .filter(Boolean)
          .join(" "),
      );
      if (!texto.includes(termo)) return false;
    }
    return true;
  });

  const entradas = lista.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.valor, 0);
  const saidas = lista.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.valor, 0);

  const porDia = new Map<string, Lancamento[]>();
  for (const l of lista) porDia.set(l.data, [...(porDia.get(l.data) ?? []), l]);

  const filtrosAtivos =
    (f.tipo !== "todos" ? 1 : 0) + (f.pessoa !== "todos" ? 1 : 0) + (f.forma !== "todas" ? 1 : 0) + (f.onde ? 1 : 0) + (f.categoria ? 1 : 0);

  const grupos = dados.grupos.filter((g) => !g.negocio_id);
  const idsDosNegocios = new Set(dados.grupos.filter((g) => g.negocio_id).map((g) => g.id));
  const categoriasDaCasa = dados.categorias.filter((c) => !c.grupo_id || !idsDosNegocios.has(c.grupo_id));

  return (
    <Pagina>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Extrato</h1>
        <Link href="/importar" className="botao-secundario py-2 text-sm">Importar PDF do banco</Link>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button aria-label="Mês anterior" disabled={f.todosOsMeses} onClick={() => mudar({ mes: somarMeses(f.mes, -1) })} className="botao-secundario px-4 disabled:opacity-30">‹</button>
        <button onClick={() => mudar({ todosOsMeses: !f.todosOsMeses })} className="text-center">
          <span className="block text-lg font-semibold capitalize">{f.todosOsMeses ? "Todos os meses" : nomeMes(f.mes, true)}</span>
          <span className="block text-xs text-tinta/50 underline">{f.todosOsMeses ? "ver um mês só" : "ver todos os meses"}</span>
        </button>
        <button aria-label="Próximo mês" disabled={f.todosOsMeses} onClick={() => mudar({ mes: somarMeses(f.mes, 1) })} className="botao-secundario px-4 disabled:opacity-30">›</button>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          type="search"
          className="campo"
          placeholder="Buscar: mercado, posto, 150…"
          value={f.busca}
          onChange={(e) => mudar({ busca: e.target.value })}
        />
        <button onClick={() => setAbrirFiltros(!abrirFiltros)} className={`botao-secundario shrink-0 ${filtrosAtivos ? "bg-tinta text-white ring-tinta" : ""}`}>
          Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ""}
        </button>
      </div>

      {abrirFiltros && (
        <div className="cartao mb-4 space-y-4">
          <Chips
            titulo="Tipo"
            valor={f.tipo}
            opcoes={[["todos", "Tudo"], ["saida", "Saiu"], ["entrada", "Entrou"], ["transferencia", "Entre contas"]]}
            mudar={(v) => mudar({ tipo: v as Filtros["tipo"] })}
          />
          <Chips
            titulo="De quem"
            valor={f.pessoa}
            opcoes={[["todos", "Todos"], ["diego", NOME_DONO.diego], ["jo", NOME_DONO.jo], ["casa", NOME_DONO.casa]]}
            mudar={(v) => mudar({ pessoa: v as Filtros["pessoa"] })}
          />
          <Chips
            titulo="Forma de pagamento"
            valor={f.forma}
            opcoes={[["todas", "Todas"], ["pix", "Pix"], ["credito", "Crédito"], ["debito", "Débito"], ["dinheiro", "Dinheiro"]]}
            mudar={(v) => mudar({ forma: v as Filtros["forma"] })}
          />
          <div>
            <label htmlFor="onde" className="rotulo">Conta ou cartão</label>
            <select id="onde" className="campo" value={f.onde} onChange={(e) => mudar({ onde: e.target.value })}>
              <option value="">Todas</option>
              <optgroup label="Contas">
                {dados.contas.map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}
              </optgroup>
              <optgroup label="Cartões">
                {dados.cartoes.map((c) => <option key={c.id} value={`cartao:${c.id}`}>{c.nome}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label htmlFor="categoria" className="rotulo">Categoria</label>
            <select id="categoria" className="campo" value={f.categoria} onChange={(e) => mudar({ categoria: e.target.value })}>
              <option value="">Todas</option>
              <option value="sem">Saídas sem categoria</option>
              {grupos.length
                ? grupos.map((g) => (
                    <optgroup key={g.id} label={g.nome}>
                      {categoriasDaCasa.filter((c) => c.grupo_id === g.id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  ))
                : categoriasDaCasa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {filtrosAtivos > 0 && (
            <button className="text-sm underline" onClick={() => mudar({ tipo: "todos", pessoa: "todos", forma: "todas", onde: "", categoria: "" })}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="cartao">
          <div className="text-sm text-tinta/60">Entrou</div>
          <div className="text-xl font-semibold text-verde">{reais(entradas)}</div>
        </div>
        <div className="cartao">
          <div className="text-sm text-tinta/60">Saiu</div>
          <div className="text-xl font-semibold text-vermelho">{reais(saidas)}</div>
        </div>
      </div>

      {!f.todosOsMeses && <ParcelasDoMes mes={f.mes} />}

      <p className="mb-3 text-sm text-tinta/60">
        {lista.length === 1 ? "1 lançamento" : `${lista.length} lançamentos`} · toque em um para editar ou apagar
      </p>

      {lista.length === 0 && (
        <p className="py-10 text-center text-tinta/60">
          Nada encontrado.{" "}
          <Link href="/lancar" className="underline">Lançar agora</Link>
        </p>
      )}

      {[...porDia.entries()].map(([dia, itens]) => (
        <section key={dia} className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-tinta/60">
            {dataCurta(dia)}
            {f.todosOsMeses ? `/${dia.slice(2, 4)}` : ""}
          </h2>
          <div className="cartao divide-y divide-tinta/5 p-0">
            {itens.map((l) => {
              const transf = l.tipo === "transferencia";
              const onde = transf
                ? `${nome(l.conta_id, dados.contas) ?? "?"} → ${nome(l.conta_destino_id, dados.contas) ?? "?"}`
                : l.forma === "credito" ? nome(l.cartao_id, dados.cartoes) : nome(l.conta_id, dados.contas);
              const categoria = l.descricao ? nome(l.categoria_id, dados.categorias) : undefined;
              return (
                <Link key={l.id} href={`/lancar?id=${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:bg-tinta/5">
                  <span className="min-w-0">
                    <span className="block truncate">{titulo(l)}</span>
                    <span className="block text-xs text-tinta/50">
                      {transf ? "Entre contas" : NOME_FORMA[l.forma]}
                      {onde ? ` · ${onde}` : ""}
                      {l.parcelas > 1 ? ` · ${l.parcelas}x` : ""} · {NOME_DONO[l.de_quem]}
                      {categoria ? ` · ${categoria}` : ""}
                    </span>
                    {(!l.criado_por || (l.tipo === "saida" && !l.categoria_id)) && (
                      <span className="mt-1 flex gap-1">
                        {!l.criado_por && <span className="rounded-full bg-tinta/5 px-2 py-0.5 text-[11px] text-tinta/60">do extrato</span>}
                        {l.tipo === "saida" && !l.categoria_id && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">sem categoria</span>}
                      </span>
                    )}
                  </span>
                  <span className={`shrink-0 font-medium tabular-nums ${l.tipo === "entrada" ? "text-verde" : transf ? "text-tinta/50" : ""}`}>
                    {l.tipo === "entrada" ? "+" : transf ? "⇄" : "−"} {reais(l.valor)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </Pagina>
  );
}

function Chips({ titulo, valor, opcoes, mudar }: { titulo: string; valor: string; opcoes: [string, string][]; mudar: (v: string) => void }) {
  return (
    <div>
      <div className="rotulo">{titulo}</div>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(([v, r]) => (
          <button key={v} onClick={() => mudar(v)} className={`chip py-1.5 text-sm ${valor === v ? "chip-ativo" : ""}`}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
