"use client";

// Caixas do Studio Pilates e do Espaço Soletti, separados da casa.

import { useEffect, useRef, useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { BlocoOrcamento } from "@/components/Orcamento";
import { useSessao } from "@/components/Sessao";
import { SeletorCategoria } from "@/components/SeletorCategoria";
import { excluir, modoDemo, salvar } from "@/lib/dados";
import { nomeMes, somarMeses, type Mes } from "@/lib/fatura";
import { dataCurta, hoje, lerValor, NOME_FORMA, reais } from "@/lib/formato";
import { NOME_GRUPO, repassesDoNegocio, resumoNegocio, type ResumoNegocio } from "@/lib/negocios";
import { gastosPorCategoria, ritmoDoMes } from "@/lib/orcamento";
import { noMes } from "@/lib/painel";
import type { Forma, Grupo, Lancamento, Negocio } from "@/lib/tipos";

const CHAVE_ABA = "financas-negocio";
const FORMAS: Forma[] = ["pix", "dinheiro", "debito"];

function mesDeHoje(): Mes {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

export default function Negocios() {
  const { dados } = useSessao();
  const negocios = dados.negocios.filter((n) => n.ativo);
  const [abaId, setAbaId] = useState<string | undefined>(undefined);
  const [mes, setMes] = useState<Mes>(mesDeHoje());

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_ABA);
      if (salvo) setAbaId(salvo);
    } catch {}
  }, []);

  const negocio = negocios.find((n) => n.id === abaId) ?? negocios[0];

  function escolher(id: string) {
    setAbaId(id);
    try {
      localStorage.setItem(CHAVE_ABA, id);
    } catch {}
  }

  if (!negocio) {
    return (
      <Pagina titulo="Negócios">
        <div className="rounded-2xl bg-vermelho-claro p-4 text-sm">
          {modoDemo ? "Nenhum negócio cadastrado." : (
            <>
              <strong>Falta atualizar o banco de dados.</strong> No Supabase, abra o SQL Editor, cole o arquivo{" "}
              <code>supabase/migrations/0004_negocios.sql</code> e clique em Run.
            </>
          )}
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <div className="mb-3 grid grid-cols-2 rounded-2xl bg-white p-1 ring-1 ring-tinta/10">
        {negocios.map((n) => (
          <button
            key={n.id}
            onClick={() => escolher(n.id)}
            className={`rounded-xl py-2.5 font-semibold ${n.id === negocio.id ? "bg-tinta text-white" : "text-tinta/60"}`}
          >
            {n.nome}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <button aria-label="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))} className="botao-secundario px-4 py-2">‹</button>
        <h1 className="text-lg font-semibold capitalize">{nomeMes(mes, true)}</h1>
        <button aria-label="Próximo mês" onClick={() => setMes(somarMeses(mes, 1))} className="botao-secundario px-4 py-2">›</button>
      </div>

      <Caixa key={`${negocio.id}-${mes.ano}-${mes.mes}`} negocio={negocio} mes={mes} />
    </Pagina>
  );
}

function Caixa({ negocio, mes }: { negocio: Negocio; mes: Mes }) {
  const { dados, recarregar } = useSessao();
  const r = resumoNegocio(negocio, mes, dados.lancamentosNegocios, dados.lancamentos);
  const doMes = dados.lancamentosNegocios
    .filter((l) => l.negocio_id === negocio.id && noMes(l.data, mes))
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  const repasses = repassesDoNegocio(negocio, dados.lancamentos).filter((l) => noMes(l.data, mes));
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [lancando, setLancando] = useState(false);

  const anterior = somarMeses(mes, -1);
  const fixasAnteriores = dados.lancamentosNegocios.filter(
    (l) => l.negocio_id === negocio.id && l.grupo === "fixa" && noMes(l.data, anterior),
  );
  const temFixas = doMes.some((l) => l.grupo === "fixa");

  async function repetirFixas() {
    for (const l of fixasAnteriores) {
      const dia = Math.min(Number(l.data.slice(8, 10)), 28);
      await salvar("lancamentos", {
        ...semId(l),
        data: `${mes.ano}-${String(mes.mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
      });
    }
    await recarregar();
  }

  const gruposDoNegocio = new Set(dados.grupos.filter((g) => g.negocio_id === negocio.id).map((g) => g.id));
  const orcamento = gastosPorCategoria(
    dados.categorias.filter((c) => c.grupo_id && gruposDoNegocio.has(c.grupo_id)),
    dados.lancamentosNegocios.filter((l) => l.negocio_id === negocio.id),
    [],
    mes,
    hoje(),
    true,
  );

  return (
    <>
      <Painel r={r} />

      <BlocoOrcamento itens={orcamento} ritmo={ritmoDoMes(mes, hoje())} titulo={`Orçamento de ${nomeMes(mes)}`} ajustes="/cadastros#negocios" />

      <PassarParaCasa negocio={negocio} sugerido={Math.max(0, r.caixa)} />

      {!temFixas && fixasAnteriores.length > 0 && (
        <button onClick={repetirFixas} className="botao-secundario mb-3 w-full text-sm">
          {fixasAnteriores.length === 1 ? "Repetir a despesa fixa" : `Repetir as ${fixasAnteriores.length} despesas fixas`} de {nomeMes(anterior)}
        </button>
      )}

      {editando || lancando ? (
        <Formulario
          key={editando?.id ?? "novo"}
          negocio={negocio}
          mes={mes}
          editando={editando}
          aoTerminar={() => {
            setEditando(null);
            setLancando(false);
          }}
        />
      ) : (
        <button onClick={() => setLancando(true)} className="botao-secundario mb-3 w-full py-3 font-semibold">
          + Lançar entrada ou saída
        </button>
      )}

      <div className="cartao divide-y divide-tinta/5 p-0 text-sm">
        {doMes.length === 0 && repasses.length === 0 && (
          <p className="px-4 py-6 text-center text-tinta/60">Nada lançado em {nomeMes(mes)}.</p>
        )}
        {repasses.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span>
              Passado para a casa
              <span className="block text-xs text-tinta/50">{dataCurta(l.data)}</span>
            </span>
            <span className="tabular-nums text-tinta/60">⇄ {reais(l.valor)}</span>
          </div>
        ))}
        {doMes.map((l) => (
          <button key={l.id} onClick={() => setEditando(l)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left active:bg-tinta/5">
            <span className="min-w-0">
              <span className="block truncate">{l.descricao || dados.categorias.find((c) => c.id === l.categoria_id)?.nome || NOME_GRUPO[l.grupo ?? "outra"]}</span>
              <span className="block text-xs text-tinta/50">
                {dataCurta(l.data)} · {dados.categorias.find((c) => c.id === l.categoria_id)?.nome ?? NOME_GRUPO[l.grupo ?? (l.tipo === "entrada" ? "outra" : "variavel")]} · {NOME_FORMA[l.forma]}
              </span>
            </span>
            <span className={`shrink-0 tabular-nums ${l.tipo === "entrada" ? "text-verde" : ""}`}>
              {l.tipo === "entrada" ? "+" : "−"} {reais(l.valor)}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function semId(l: Lancamento) {
  const { id, criado_em, criado_por, ...resto } = l;
  return resto;
}

/** Painel simples do mês: entradas, saídas e saldo. */
function Painel({ r }: { r: ResumoNegocio }) {
  const saidas = r.fixas + r.variaveis;
  const maior = Math.max(r.entradas, saidas, 1);
  return (
    <div className="cartao mb-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-verde-claro p-3">
          <span className="block text-xs text-tinta/60">Entradas</span>
          <span className="block text-lg font-semibold tabular-nums text-verde">{reais(r.entradas)}</span>
          <Barra valor={r.entradas} maior={maior} cor="bg-verde" />
        </div>
        <div className="rounded-xl bg-vermelho-claro p-3">
          <span className="block text-xs text-tinta/60">Saídas</span>
          <span className="block text-lg font-semibold tabular-nums text-vermelho">{reais(saidas)}</span>
          <Barra valor={saidas} maior={maior} cor="bg-vermelho" />
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="font-medium">Saldo do mês</span>
        <span className={`text-2xl font-bold tabular-nums ${r.resultado < 0 ? "text-vermelho" : "text-verde"}`}>{reais(r.resultado)}</span>
      </div>
      <div className="space-y-1 border-t border-tinta/10 pt-2 text-xs text-tinta/60">
        <div className="flex justify-between"><span>Despesas fixas · variáveis</span><span className="tabular-nums">{reais(r.fixas)} · {reais(r.variaveis)}</span></div>
        <div className="flex justify-between"><span>Passado para a casa</span><span className="tabular-nums">{reais(r.passado)}</span></div>
        <div className="flex justify-between font-medium text-tinta"><span>Fica no caixa do negócio</span><span className={`tabular-nums ${r.caixa < 0 ? "text-vermelho" : ""}`}>{reais(r.caixa)}</span></div>
      </div>
    </div>
  );
}

function Barra({ valor, maior, cor }: { valor: number; maior: number; cor: string }) {
  return (
    <div className="mt-2 h-1.5 rounded-full bg-white">
      <div className={`h-1.5 rounded-full ${cor}`} style={{ width: `${Math.round((valor / maior) * 100)}%` }} />
    </div>
  );
}

/** Lança na casa a sobra do negócio, como renda da casa. */
function PassarParaCasa({ negocio, sugerido }: { negocio: Negocio; sugerido: number }) {
  const { dados, recarregar } = useSessao();
  const fonte = dados.fontes.find((f) => f.id === negocio.fonte_id);
  const contas = dados.contas.filter((c) => c.ativo);
  const [aberto, setAberto] = useState(false);
  const [valorTexto, setValorTexto] = useState("");
  const [contaId, setContaId] = useState(fonte?.conta_id ?? contas[0]?.id);
  const [salvando, setSalvando] = useState(false);

  if (!fonte) return null;

  if (!aberto) {
    return (
      <button
        onClick={() => {
          setValorTexto(sugerido ? String(sugerido).replace(".", ",") : "");
          setAberto(true);
        }}
        className="botao-principal mb-3 py-3 text-base"
      >
        Passar sobra para a casa
      </button>
    );
  }

  async function confirmar() {
    const valor = lerValor(valorTexto);
    if (valor <= 0) return;
    setSalvando(true);
    try {
      await salvar("lancamentos", {
        tipo: "entrada",
        valor,
        data: hoje(),
        descricao: `Sobra do ${negocio.nome}`,
        forma: "pix",
        conta_id: contaId ?? null,
        cartao_id: null,
        parcelas: 1,
        fonte_id: fonte!.id,
        categoria_id: null,
        de_quem: "jo",
      });
      await recarregar();
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="cartao mb-3 space-y-2">
      <p className="text-sm text-tinta/70">Entra na casa como renda "{fonte.nome}" e sai do caixa do negócio.</p>
      <div className="flex items-center rounded-xl bg-white px-3 ring-1 ring-tinta/15">
        <span className="text-tinta/40">R$</span>
        <input inputMode="decimal" autoFocus value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} className="w-full bg-transparent px-2 py-2.5 text-lg font-semibold outline-none" aria-label="Valor" />
      </div>
      <span className="block text-xs text-tinta/60">Caiu na conta</span>
      <div className="flex flex-wrap gap-2">
        {contas.map((c) => (
          <button key={c.id} onClick={() => setContaId(c.id)} className={`chip py-1.5 text-sm ${contaId === c.id ? "chip-ativo" : ""}`}>{c.nome}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={confirmar} disabled={salvando} className="rounded-lg bg-tinta px-4 py-2 font-medium text-white">{salvando ? "Salvando…" : "Confirmar"}</button>
        <button onClick={() => setAberto(false)} className="px-3 py-2 text-tinta/60">Cancelar</button>
      </div>
    </div>
  );
}

/** Lançar ou editar uma entrada ou saída do negócio. */
function Formulario({ negocio, mes, editando, aoTerminar }: { negocio: Negocio; mes: Mes; editando: Lancamento | null; aoTerminar: () => void }) {
  const { dados, recarregar } = useSessao();
  const ehEspaco = /espa/i.test(negocio.nome);
  const gruposEntrada: Grupo[] = ehEspaco ? ["aluguel", "outra"] : ["aluno", "outra"];
  const grupos: Grupo[] = [...gruposEntrada, "fixa", "variavel"];
  const [grupo, setGrupo] = useState<Grupo>(editando?.grupo ?? gruposEntrada[0]);
  const [valorTexto, setValorTexto] = useState(editando ? String(editando.valor).replace(".", ",") : "");
  const [descricao, setDescricao] = useState(editando?.descricao ?? "");
  const [forma, setForma] = useState<Forma>(editando?.forma ?? "pix");
  const mesHoje = mesDeHoje();
  const dataPadrao = mes.ano === mesHoje.ano && mes.mes === mesHoje.mes ? hoje() : `${mes.ano}-${String(mes.mes).padStart(2, "0")}-01`;
  const [data, setData] = useState(editando?.data ?? dataPadrao);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const entrada = gruposEntrada.includes(grupo);
  const [categoriaId, setCategoriaId] = useState(editando?.categoria_id ?? "");

  // Grupos de categorias do negócio. Mostra primeiro os que combinam com o tipo escolhido.
  const gruposDoNegocio = dados.grupos.filter((g) => g.negocio_id === negocio.id);
  const padrao = entrada ? /entrada/i : grupo === "fixa" ? /fix/i : /vari/i;
  const combinam = gruposDoNegocio.filter((g) => padrao.test(g.nome));
  const gruposVisiveis = combinam.length ? combinam : gruposDoNegocio;
  const categoriasVisiveis = dados.categorias.filter((c) => gruposVisiveis.some((g) => g.id === c.grupo_id));

  const dica: Record<Grupo, string> = {
    aluno: "Nome do aluno",
    aluguel: "Qual sala ou inquilino",
    outra: "De onde veio",
    fixa: "Ex.: aluguel da sala, energia, contador",
    variavel: "Ex.: material, manutenção",
  };

  async function aoSalvar() {
    const valor = lerValor(valorTexto);
    if (valor <= 0) {
      campo.current?.focus();
      return;
    }
    setSalvando(true);
    try {
      await salvar("lancamentos", {
        id: editando?.id,
        tipo: entrada ? "entrada" : "saida",
        valor,
        data,
        descricao: descricao.trim() || null,
        forma,
        conta_id: null,
        cartao_id: null,
        parcelas: 1,
        fonte_id: null,
        categoria_id: categoriasVisiveis.some((c) => c.id === categoriaId) ? categoriaId : null,
        de_quem: "jo",
        negocio_id: negocio.id,
        grupo,
      });
      await recarregar();
      setValorTexto("");
      setDescricao("");
      setAviso("Salvo!");
      setTimeout(() => setAviso(null), 2000);
      if (editando) aoTerminar();
    } catch (e) {
      setAviso(`Não salvou: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSalvando(false);
    }
  }

  async function aoExcluir() {
    if (!editando || !confirm("Apagar este lançamento?")) return;
    await excluir("lancamentos", editando.id);
    await recarregar();
    aoTerminar();
  }

  return (
    <div className="cartao mb-3 space-y-3">
      <div className="text-sm font-medium">{editando ? "Editar lançamento" : `Lançar no ${negocio.nome}`}</div>
      <div className="flex flex-wrap gap-2">
        {grupos.map((g) => (
          <button
            key={g}
            onClick={() => setGrupo(g)}
            className={`chip px-3 py-1.5 text-sm ${grupo === g ? (gruposEntrada.includes(g) ? "bg-verde text-white ring-verde" : "bg-vermelho text-white ring-vermelho") : ""}`}
          >
            {NOME_GRUPO[g]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex w-36 shrink-0 items-center rounded-xl bg-white px-3 ring-1 ring-tinta/15">
          <span className="text-tinta/40">R$</span>
          <input ref={campo} inputMode="decimal" placeholder="0,00" value={valorTexto} onChange={(e) => setValorTexto(e.target.value)} className="w-full bg-transparent px-2 py-2.5 font-semibold outline-none" aria-label="Valor" />
        </div>
        <input className="campo py-2.5" placeholder={dica[grupo]} value={descricao} onChange={(e) => setDescricao(e.target.value)} aria-label="Descrição" />
      </div>
      <SeletorCategoria
        className="campo py-2.5"
        valor={categoriasVisiveis.some((c) => c.id === categoriaId) ? categoriaId : ""}
        aoMudar={setCategoriaId}
        grupos={gruposVisiveis}
        negocioId={negocio.id}
      />
      <div className="flex flex-wrap items-center gap-2">
        {FORMAS.map((f) => (
          <button key={f} onClick={() => setForma(f)} className={`chip px-3 py-1.5 text-sm ${forma === f ? "chip-ativo" : ""}`}>{NOME_FORMA[f]}</button>
        ))}
        <input type="date" value={data} onChange={(e) => setData(e.target.value || dataPadrao)} className="campo w-auto px-2 py-1.5 text-sm" aria-label="Data" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={aoSalvar} disabled={salvando} className="rounded-xl bg-tinta px-5 py-2.5 font-semibold text-white disabled:opacity-40">
          {salvando ? "Salvando…" : editando ? "Salvar alteração" : "Salvar"}
        </button>
        {editando && (
          <>
            <button onClick={aoTerminar} className="text-sm text-tinta/60">Cancelar</button>
            <button onClick={aoExcluir} className="ml-auto text-sm text-vermelho">Apagar</button>
          </>
        )}
        {aviso && <span className="text-sm text-tinta/60">{aviso}</span>}
      </div>
    </div>
  );
}
