"use client";

// Negócios: uma tela com o Studio Pilates e o Espaço Soletti lado a lado.
// Tocando num deles abre o painel do negócio (parecido com a tela inicial da
// casa) e, dali, os lançamentos do mês.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { BlocoOrcamento, curto, tom } from "@/components/Orcamento";
import { useSessao } from "@/components/Sessao";
import { SeletorCategoria } from "@/components/SeletorCategoria";
import { excluir, modoDemo, salvar } from "@/lib/dados";
import { nomeMes, somarMeses, type Mes } from "@/lib/fatura";
import { dataCurta, hoje, lerValor, NOME_FORMA, reais } from "@/lib/formato";
import { NOME_GRUPO, previsaoEntradas, repassesDoNegocio, resumoNegocio, type PrevisaoEntradas, type ResumoNegocio } from "@/lib/negocios";
import { gastosPorCategoria, ritmoDoMes } from "@/lib/orcamento";
import { noMes } from "@/lib/painel";
import type { Forma, Grupo, Lancamento, Negocio } from "@/lib/tipos";

const FORMAS: Forma[] = ["pix", "dinheiro", "debito"];

function mesDeHoje(): Mes {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

const chave = (m: Mes) => `${m.ano}-${String(m.mes).padStart(2, "0")}`;
function lerMes(t: string | null): Mes {
  const m = t?.match(/^(\d{4})-(\d{2})$/);
  return m ? { ano: Number(m[1]), mes: Number(m[2]) } : mesDeHoje();
}

export default function Negocios() {
  return (
    <Suspense fallback={<Pagina><p className="text-sm text-tinta/60">Carregando…</p></Pagina>}>
      <Telas />
    </Suspense>
  );
}

function Telas() {
  const { dados } = useSessao();
  const busca = useSearchParams();
  const negocios = dados.negocios.filter((n) => n.ativo);
  const negocio = negocios.find((n) => n.id === busca.get("n"));
  const mes = lerMes(busca.get("m"));

  if (negocios.length === 0) {
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

  if (!negocio) return <Visao negocios={negocios} mes={mes} />;
  if (busca.get("ver") === "lancamentos") return <Lancamentos key={`${negocio.id}-${chave(mes)}`} negocio={negocio} mes={mes} />;
  return <PainelNegocio key={`${negocio.id}-${chave(mes)}`} negocio={negocio} mes={mes} />;
}

/** Contas do negócio usadas nas três telas. */
function useNegocio(negocio: Negocio, mes: Mes) {
  const { dados } = useSessao();
  const r = resumoNegocio(negocio, mes, dados.lancamentosNegocios, dados.lancamentos);
  const gruposDoNegocio = new Set(dados.grupos.filter((g) => g.negocio_id === negocio.id).map((g) => g.id));
  const orcamento = gastosPorCategoria(
    dados.categorias.filter((c) => c.grupo_id && gruposDoNegocio.has(c.grupo_id)),
    dados.lancamentosNegocios.filter((l) => l.negocio_id === negocio.id),
    [],
    mes,
    hoje(),
    true,
  );
  const historico = [5, 4, 3, 2, 1, 0].map((k) => {
    const m = somarMeses(mes, -k);
    return { mes: m, r: resumoNegocio(negocio, m, dados.lancamentosNegocios, dados.lancamentos) };
  });
  const previsao = previsaoEntradas(negocio, mes, dados.lancamentosNegocios);
  return { r, orcamento, historico, previsao };
}

/** Seletor de mês: ‹ novembro › */
function TrocaMes({ mes, href }: { mes: Mes; href: (m: Mes) => string }) {
  return (
    <div className="flex items-center gap-1">
      <Link aria-label="Mês anterior" href={href(somarMeses(mes, -1))} className="botao-secundario px-3 py-1.5">‹</Link>
      <span className="min-w-24 text-center text-sm font-semibold capitalize">{nomeMes(mes)}</span>
      <Link aria-label="Próximo mês" href={href(somarMeses(mes, 1))} className="botao-secundario px-3 py-1.5">›</Link>
    </div>
  );
}

// ───────────────────────── 1. Visão dos dois negócios ─────────────────────────

function Visao({ negocios, mes }: { negocios: Negocio[]; mes: Mes }) {
  return (
    <Pagina larga>
      <div className="mb-3 flex items-center justify-between lg:mb-6">
        <h1 className="text-xl font-semibold lg:text-2xl">Negócios</h1>
        <TrocaMes mes={mes} href={(m) => `/negocios?m=${chave(m)}`} />
      </div>
      <Juntos negocios={negocios} mes={mes} />
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        {negocios.map((n) => <CartaoNegocio key={n.id} negocio={n} mes={mes} />)}
      </div>
    </Pagina>
  );
}

function Juntos({ negocios, mes }: { negocios: Negocio[]; mes: Mes }) {
  const { dados } = useSessao();
  const rs = negocios.map((n) => resumoNegocio(n, mes, dados.lancamentosNegocios, dados.lancamentos));
  const sobra = rs.reduce((s, r) => s + r.resultado, 0);
  const passado = rs.reduce((s, r) => s + r.passado, 0);
  const caixa = rs.reduce((s, r) => s + r.caixa, 0);
  return (
    <div className="cartao mb-3 grid grid-cols-3 gap-2 px-3 py-2.5 text-center">
      <Numero rotulo={`Sobra de ${nomeMes(mes)}`} valor={sobra} cor />
      <Numero rotulo="Já foi para a casa" valor={passado} />
      <Numero rotulo="Guardado nos negócios" valor={caixa} />
    </div>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: boolean }) {
  return (
    <div>
      <div className="text-[10px] leading-tight text-tinta/60">{rotulo}</div>
      <div className={`text-base font-semibold tabular-nums ${cor ? (valor < 0 ? "text-vermelho" : "text-verde") : ""}`}>{curto(valor)}</div>
    </div>
  );
}

function CartaoNegocio({ negocio, mes }: { negocio: Negocio; mes: Mes }) {
  const { r, orcamento, historico, previsao } = useNegocio(negocio, mes);
  const saidas = r.fixas + r.variaveis;
  const t = tom(r.resultado, r.entradas);
  const alerta = orcamento.filter((i) => i.situacao !== "ok");
  return (
    <Link href={`/negocios?n=${negocio.id}&m=${chave(mes)}`} className="cartao mb-3 block px-3 py-3 transition active:scale-[0.99]">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold">{negocio.nome}</span>
        <span className="text-sm text-tinta/50">abrir ›</span>
      </div>
      <div className={`mt-2 rounded-xl px-3 py-2 ${t.fundo}`}>
        <div className="text-xs text-tinta/60">Sobra de {nomeMes(mes)}</div>
        <div className={`text-2xl font-bold tracking-tight tabular-nums ${t.texto}`}>{curto(r.resultado)}</div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div><span className="block text-xs text-tinta/60">Entrou</span><span className="font-semibold tabular-nums text-verde">{curto(r.entradas)}</span></div>
        <div><span className="block text-xs text-tinta/60">Saiu</span><span className="font-semibold tabular-nums text-vermelho">{curto(saidas)}</span></div>
      </div>
      {previsao.previsto > previsao.jaEntrou && (
        <div className="mt-1 text-xs text-tinta/60">
          Ainda deve entrar <strong className="text-verde">{curto(previsao.previsto - previsao.jaEntrou)}</strong> · previsto {curto(previsao.previsto)}
        </div>
      )}
      <MiniGrafico historico={historico} />
      <div className="mt-2 flex items-baseline justify-between border-t border-tinta/10 pt-2 text-xs text-tinta/60">
        <span>No caixa do negócio</span>
        <span className={`font-medium tabular-nums ${r.caixa < 0 ? "text-vermelho" : "text-tinta"}`}>{curto(r.caixa)}</span>
      </div>
      {alerta.length > 0 && (
        <div className="mt-2 rounded-lg bg-amarelo-claro px-2 py-1 text-xs text-amarelo">
          {alerta.map((i) => i.categoria.nome).join(", ")}: {alerta.some((i) => i.situacao === "estourou") ? "passou do orçamento" : "gastando rápido"}
        </div>
      )}
    </Link>
  );
}

/** Seis barrinhas com a sobra de cada mês (verde sobrou, vermelho faltou). */
function MiniGrafico({ historico }: { historico: { mes: Mes; r: ResumoNegocio }[] }) {
  const maior = Math.max(1, ...historico.map((h) => Math.abs(h.r.resultado)));
  return (
    <div className="mt-2">
      <div className="text-[10px] text-tinta/50">Sobra dos últimos 6 meses</div>
      <div className="mt-1 flex h-10 items-end gap-1">
        {historico.map((h, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
            <div
              className={`w-full rounded-sm ${h.r.resultado < 0 ? "bg-vermelho/70" : i === historico.length - 1 ? "bg-verde" : "bg-verde/40"}`}
              style={{ height: `${Math.max(3, (Math.abs(h.r.resultado) / maior) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-center text-[9px] text-tinta/40">
        {historico.map((h, i) => <span key={i} className="flex-1">{nomeMes(h.mes).slice(0, 3)}</span>)}
      </div>
    </div>
  );
}

// ───────────────────────── 2. Painel de um negócio ─────────────────────────

function PainelNegocio({ negocio, mes }: { negocio: Negocio; mes: Mes }) {
  const { dados } = useSessao();
  const { r, orcamento, historico, previsao } = useNegocio(negocio, mes);
  const t = tom(r.resultado, r.entradas);
  const qtd = dados.lancamentosNegocios.filter((l) => l.negocio_id === negocio.id && noMes(l.data, mes)).length;
  const base = `/negocios?n=${negocio.id}`;

  return (
    <Pagina larga>
      <Link href={`/negocios?m=${chave(mes)}`} className="mb-1 inline-block text-sm text-tinta/60">‹ Negócios</Link>
      <div className="mb-3 flex items-center justify-between gap-2 lg:mb-6">
        <h1 className="truncate text-xl font-semibold lg:text-2xl">{negocio.nome}</h1>
        <TrocaMes mes={mes} href={(m) => `${base}&m=${chave(m)}`} />
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>
          <div className="mb-1 grid grid-cols-2 gap-2">
            <div className={`rounded-2xl px-3 py-2.5 ring-1 ring-tinta/5 ${t.fundo}`}>
              <div className="text-xs font-medium">Sobra de {nomeMes(mes)}</div>
              <div className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${t.texto}`}>{curto(r.resultado)}</div>
              <div className="text-xs text-tinta/70">entrou − saiu</div>
            </div>
            <div className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-tinta/5">
              <div className="text-xs font-medium">No caixa do negócio</div>
              <div className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${r.caixa < 0 ? "text-vermelho" : ""}`}>{curto(r.caixa)}</div>
              <div className="text-xs text-tinta/70">guardado até agora</div>
            </div>
          </div>
          <Link href={`${base}&ver=lancamentos&m=${chave(mes)}`} className="mb-3 block px-1 text-right text-xs text-tinta/60 underline">
            Ver os {qtd} lançamentos de {nomeMes(mes)}
          </Link>

          <Previsao p={previsao} mes={mes} espaco={/espa/i.test(negocio.nome)} />
          <EntrouSaiu r={r} />
          <BlocoOrcamento itens={orcamento} ritmo={ritmoDoMes(mes, hoje())} titulo={`Orçamento de ${nomeMes(mes)}`} ajustes="/cadastros#negocios" />
        </div>
        <div>
          <Grafico historico={historico} />
          <MaioresGastos negocio={negocio} mes={mes} />
          <PassarParaCasa negocio={negocio} sugerido={Math.max(0, r.caixa)} />
          <Link href={`${base}&ver=lancamentos&m=${chave(mes)}`} className="botao-secundario mb-3 block w-full py-3 text-center font-semibold">
            + Lançar entrada ou saída
          </Link>
        </div>
      </div>
    </Pagina>
  );
}

/** O que ainda deve entrar este mês e o previsto para o mês que vem. */
function Previsao({ p, mes, espaco }: { p: PrevisaoEntradas; mes: Mes; espaco: boolean }) {
  const quem = (n: number) => (espaco ? (n === 1 ? "aluguel" : "aluguéis") : n === 1 ? "aluno" : "alunos");
  const falta = p.previsto - p.jaEntrou;
  const seguinte = somarMeses(mes, 1);
  const sobraSeguinte = p.previstoSeguinte - p.fixas;
  const pct = p.previsto > 0 ? Math.min(100, (p.jaEntrou / p.previsto) * 100) : 0;
  if (p.previsto === 0 && p.previstoSeguinte === 0) return null;
  return (
    <div className="cartao mb-3 px-3 py-2.5">
      <div className="mb-1 flex items-baseline justify-between text-xs font-medium text-tinta/50">
        <span>Previsão de entradas</span>
        <span className="tabular-nums">{curto(p.jaEntrou)} de {curto(p.previsto)}</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium capitalize">{nomeMes(mes)}</span>
        <span className="tabular-nums">previsto <strong>{curto(p.previsto)}</strong></span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-verde-claro" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-verde" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[11px] text-tinta/60">
        {falta > 0 ? (
          <>já entrou {curto(p.jaEntrou)} · <span className="text-verde">ainda deve entrar {curto(falta)}</span> de {p.faltam.length} {quem(p.faltam.length)}</>
        ) : (
          <>todos que pagaram no mês anterior já pagaram</>
        )}
      </div>
      {p.faltam.length > 0 && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-tinta/60 underline">quem ainda não pagou</summary>
          <ul className="mt-1 space-y-0.5">
            {p.faltam.map((f) => (
              <li key={f.nome} className="flex justify-between"><span className="truncate">{f.nome}</span><span className="tabular-nums">{curto(f.valor)}</span></li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-tinta/10 pt-2">
        <div>
          <div className="text-[11px] text-tinta/60">Entra em {nomeMes(seguinte)}</div>
          <div className="text-base font-semibold tabular-nums text-verde">{curto(p.previstoSeguinte)}</div>
          <div className="text-[10px] text-tinta/50">{p.seguinte.length} {quem(p.seguinte.length)}</div>
        </div>
        <div>
          <div className="text-[11px] text-tinta/60">Sobra prevista</div>
          <div className={`text-base font-semibold tabular-nums ${sobraSeguinte < 0 ? "text-vermelho" : "text-verde"}`}>{curto(sobraSeguinte)}</div>
          <div className="text-[10px] text-tinta/50">menos {curto(p.fixas)} de despesas fixas</div>
        </div>
      </div>
    </div>
  );
}

/** Para onde foi o dinheiro: entradas e saídas do mês em barras. */
function EntrouSaiu({ r }: { r: ResumoNegocio }) {
  const linhas = [
    { nome: "Entrou", valor: r.entradas, cor: "bg-verde" },
    { nome: "Despesas fixas", valor: r.fixas, cor: "bg-vermelho" },
    { nome: "Despesas variáveis", valor: r.variaveis, cor: "bg-vermelho/60" },
    { nome: "Passado para a casa", valor: r.passado, cor: "bg-tinta/40" },
  ];
  const maior = Math.max(1, ...linhas.map((l) => l.valor));
  return (
    <div className="cartao mb-3 space-y-2 px-3 py-2.5">
      <div className="text-xs font-medium text-tinta/50">Entrou e saiu</div>
      {linhas.map((l) => (
        <div key={l.nome}>
          <div className="flex justify-between text-sm"><span>{l.nome}</span><span className="tabular-nums">{curto(l.valor)}</span></div>
          <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-tinta/10">
            <div className={`h-full rounded-full ${l.cor}`} style={{ width: `${(l.valor / maior) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Seis meses de entradas e saídas, lado a lado. */
function Grafico({ historico }: { historico: { mes: Mes; r: ResumoNegocio }[] }) {
  const maior = Math.max(1, ...historico.flatMap((h) => [h.r.entradas, h.r.fixas + h.r.variaveis]));
  const comDados = historico.filter((h) => h.r.entradas || h.r.fixas || h.r.variaveis);
  const media = comDados.length ? comDados.reduce((s, h) => s + h.r.resultado, 0) / comDados.length : 0;
  return (
    <div className="cartao mb-3 px-3 py-2.5">
      <div className="mb-2 flex items-baseline justify-between text-xs font-medium text-tinta/50">
        <span>Últimos 6 meses</span>
        <span className="flex gap-2">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-verde" />entrou</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-vermelho" />saiu</span>
        </span>
      </div>
      <div className="flex h-28 items-end gap-2">
        {historico.map((h, i) => {
          const saiu = h.r.fixas + h.r.variaveis;
          return (
            <div key={i} className="flex h-full flex-1 items-end justify-center gap-0.5">
              <div className="w-1/2 rounded-t bg-verde" style={{ height: `${(h.r.entradas / maior) * 100}%` }} title={`Entrou ${reais(h.r.entradas)}`} />
              <div className="w-1/2 rounded-t bg-vermelho" style={{ height: `${(saiu / maior) * 100}%` }} title={`Saiu ${reais(saiu)}`} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2 text-center text-[10px]">
        {historico.map((h, i) => (
          <div key={i} className="flex-1">
            <div className="capitalize text-tinta/50">{nomeMes(h.mes).slice(0, 3)}</div>
            <div className={`tabular-nums ${h.r.resultado < 0 ? "text-vermelho" : "text-verde"}`}>{curto(h.r.resultado).replace("R$ ", "")}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-tinta/60">
        Sobra média: <strong className={media < 0 ? "text-vermelho" : "text-verde"}>{curto(media)}</strong> por mês
      </p>
    </div>
  );
}

/** As categorias onde mais saiu dinheiro no mês. */
function MaioresGastos({ negocio, mes }: { negocio: Negocio; mes: Mes }) {
  const { dados } = useSessao();
  const saidas = dados.lancamentosNegocios.filter((l) => l.negocio_id === negocio.id && l.tipo === "saida" && noMes(l.data, mes));
  const porCategoria = new Map<string, number>();
  for (const l of saidas) {
    const nome = dados.categorias.find((c) => c.id === l.categoria_id)?.nome ?? NOME_GRUPO[l.grupo ?? "variavel"];
    porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + Number(l.valor));
  }
  const lista = [...porCategoria].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = lista.reduce((s, [, v]) => s + v, 0);
  if (lista.length === 0) return null;
  return (
    <div className="cartao mb-3 px-3 py-2.5">
      <div className="mb-2 text-xs font-medium text-tinta/50">Onde mais saiu dinheiro</div>
      <div className="space-y-1.5 text-sm">
        {lista.map(([nome, v]) => (
          <div key={nome} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate">{nome}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-tinta/10">
              <div className="h-full rounded-full bg-vermelho/70" style={{ width: `${(v / total) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums">{curto(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── 3. Lançamentos do mês ─────────────────────────

function Lancamentos({ negocio, mes }: { negocio: Negocio; mes: Mes }) {
  const { dados, recarregar } = useSessao();
  const router = useRouter();
  const doMes = dados.lancamentosNegocios
    .filter((l) => l.negocio_id === negocio.id && noMes(l.data, mes))
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  const repasses = repassesDoNegocio(negocio, dados.lancamentos).filter((l) => noMes(l.data, mes));
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [lancando, setLancando] = useState(true);
  const base = `/negocios?n=${negocio.id}`;

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

  return (
    <Pagina>
      <Link href={`${base}&m=${chave(mes)}`} className="mb-1 inline-block text-sm text-tinta/60">‹ {negocio.nome}</Link>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Lançamentos</h1>
        <TrocaMes mes={mes} href={(m) => `${base}&ver=lancamentos&m=${chave(m)}`} />
      </div>

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
      <button onClick={() => router.push(`${base}&m=${chave(mes)}`)} className="mt-3 w-full text-center text-sm text-tinta/60 underline">
        Voltar ao painel do {negocio.nome}
      </button>
    </Pagina>
  );
}

function semId(l: Lancamento) {
  const { id, criado_em, criado_por, ...resto } = l;
  return resto;
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
