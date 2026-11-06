"use client";

// Ajustes > Grupos e categorias: criar, renomear e apagar.

import { useState } from "react";
import { useSessao } from "@/components/Sessao";
import { excluir, salvar } from "@/lib/dados";
import { lerValor, reais } from "@/lib/formato";
import type { Categoria, GrupoCategoria } from "@/lib/tipos";

export function EditorCategorias({ negocioId = null }: { negocioId?: string | null }) {
  const { dados, recarregar } = useSessao();
  const [novoGrupo, setNovoGrupo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const grupos = dados.grupos.filter((g) => (g.negocio_id ?? null) === negocioId);

  async function rodar(fn: () => Promise<void>) {
    setErro(null);
    try {
      await fn();
      await recarregar();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(/duplicate|unique/i.test(msg) ? "Já existe um item com esse nome." : `Não salvou: ${msg}`);
    }
  }

  async function criarGrupo() {
    const nome = novoGrupo.trim();
    if (!nome) return;
    await rodar(() => salvar("grupos", { nome, ordem: grupos.length + 1, ...(negocioId ? { negocio_id: negocioId } : {}) }));
    setNovoGrupo("");
  }

  return (
    <div className="space-y-2">
      {erro && <p className="rounded-xl bg-vermelho-claro px-3 py-2 text-sm text-vermelho">{erro}</p>}
      {grupos.map((g) => (
        <Grupo key={g.id} grupo={g} categorias={dados.categorias.filter((c) => c.grupo_id === g.id)} rodar={rodar} />
      ))}
      <div className="flex gap-2">
        <input className="campo py-2.5" placeholder="Novo grupo" value={novoGrupo} onChange={(e) => setNovoGrupo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && criarGrupo()} aria-label={negocioId ? "Nome do novo grupo do negócio" : "Nome do novo grupo"} />
        <button className="botao-secundario shrink-0 py-2.5" onClick={criarGrupo}>Criar</button>
      </div>
    </div>
  );
}

function Grupo({ grupo, categorias, rodar }: { grupo: GrupoCategoria; categorias: Categoria[]; rodar: (fn: () => Promise<void>) => Promise<void> }) {
  const [nova, setNova] = useState("");

  async function adicionar() {
    const nome = nova.trim();
    if (!nome) return;
    await rodar(() => salvar("categorias", { nome, grupo_id: grupo.id, ordem: categorias.length + 1 }));
    setNova("");
  }

  async function apagarGrupo() {
    const aviso = categorias.length
      ? `Apagar o grupo "${grupo.nome}" e as ${categorias.length} categorias dele? Os lançamentos continuam, só ficam sem categoria.`
      : `Apagar o grupo "${grupo.nome}"?`;
    if (!confirm(aviso)) return;
    await rodar(async () => {
      for (const c of categorias) await excluir("categorias", c.id);
      await excluir("grupos", grupo.id);
    });
  }

  return (
    <details className="cartao group p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{grupo.nome}</span>
        <span className="text-sm text-tinta/50">
          {categorias.length} {categorias.length === 1 ? "categoria" : "categorias"} <span aria-hidden className="inline-block transition group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="space-y-2 border-t border-tinta/5 px-4 pb-4 pt-3">
        <Nome rotulo="Nome do grupo" valor={grupo.nome} aoSalvar={(nome) => rodar(() => salvar("grupos", { id: grupo.id, nome }))} />
        <div className="flex justify-between pt-1 text-xs font-medium text-tinta/50">
          <span>Categorias</span>
          <span className="pr-12">Orçamento por mês</span>
        </div>
        {categorias.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <Nome rotulo={`Categoria ${c.nome}`} valor={c.nome} aoSalvar={(nome) => rodar(() => salvar("categorias", { id: c.id, nome }))} />
            <Orcamento
              rotulo={`Orçamento por mês de ${c.nome}`}
              valor={c.orcamento ?? null}
              aoSalvar={(orcamento) => rodar(() => salvar("categorias", { id: c.id, orcamento }))}
            />
            <button
              aria-label={`Apagar ${c.nome}`}
              className="shrink-0 rounded-lg px-3 py-2 text-vermelho active:bg-vermelho-claro"
              onClick={() => confirm(`Apagar a categoria "${c.nome}"? Os lançamentos dela ficam sem categoria.`) && rodar(() => excluir("categorias", c.id))}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input className="campo py-2" placeholder="Nova categoria" value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} aria-label={`Nova categoria em ${grupo.nome}`} />
          <button className="botao-secundario shrink-0 py-2" onClick={adicionar}>Adicionar</button>
        </div>
        <button className="pt-1 text-sm text-vermelho" onClick={apagarGrupo}>Apagar grupo</button>
      </div>
    </details>
  );
}

/** Valor por mês da categoria. Vazio = sem orçamento. Salva ao sair do campo. */
function Orcamento({ rotulo, valor, aoSalvar }: { rotulo: string; valor: number | null; aoSalvar: (v: number | null) => void }) {
  const inicial = valor ? reais(Number(valor)).replace(/^R\$\s?/, "") : "";
  const [texto, setTexto] = useState(inicial);
  function salvarSeMudou() {
    const v = lerValor(texto) || null;
    if (v !== (valor ? Number(valor) : null)) aoSalvar(v);
    setTexto(v ? reais(v).replace(/^R\$\s?/, "") : "");
  }
  return (
    <input
      aria-label={rotulo}
      inputMode="decimal"
      placeholder="R$ —"
      className="campo w-28 shrink-0 py-2 text-right tabular-nums"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={salvarSeMudou}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Campo de nome que salva ao sair dele ou apertar Enter. */
function Nome({ rotulo, valor, aoSalvar }: { rotulo: string; valor: string; aoSalvar: (nome: string) => void }) {
  const [texto, setTexto] = useState(valor);
  function salvarSeMudou() {
    const nome = texto.trim();
    if (nome && nome !== valor) aoSalvar(nome);
    else setTexto(valor);
  }
  return (
    <input
      aria-label={rotulo}
      className="campo py-2"
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={salvarSeMudou}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
