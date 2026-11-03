"use client";

// Seletor de categoria usado ao lançar (casa e negócios), com a opção de
// criar uma categoria (e, se precisar, um grupo) ali mesmo, sem ir a Ajustes.

import { useState } from "react";
import { useSessao } from "@/components/Sessao";
import { criar } from "@/lib/dados";
import type { GrupoCategoria } from "@/lib/tipos";

const NOVA = "__nova__";
const NOVO_GRUPO = "__novo_grupo__";

export function SeletorCategoria({
  valor,
  aoMudar,
  grupos,
  negocioId = null,
  id,
  className = "campo",
}: {
  valor: string;
  aoMudar: (id: string) => void;
  grupos: GrupoCategoria[];
  negocioId?: string | null;
  id?: string;
  className?: string;
}) {
  const { dados, recarregar } = useSessao();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrir() {
    setCriando(true);
    setNome("");
    setNomeGrupo("");
    setErro(null);
    setGrupoId(grupos[0]?.id ?? NOVO_GRUPO);
  }

  async function salvarNova() {
    const nomeCat = nome.trim();
    if (!nomeCat) return setErro("Escreva o nome da categoria.");
    if (grupoId === NOVO_GRUPO && !nomeGrupo.trim()) return setErro("Escreva o nome do grupo novo.");
    setSalvando(true);
    setErro(null);
    try {
      let gid = grupoId;
      if (gid === NOVO_GRUPO) {
        const ordem = dados.grupos.filter((g) => (g.negocio_id ?? null) === negocioId).length + 1;
        gid = await criar("grupos", { nome: nomeGrupo.trim(), ordem, ...(negocioId ? { negocio_id: negocioId } : {}) });
      }
      const ordem = dados.categorias.filter((c) => c.grupo_id === gid).length + 1;
      const novaId = await criar("categorias", { nome: nomeCat, grupo_id: gid, ordem });
      await recarregar();
      aoMudar(novaId);
      setCriando(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(/duplicate|unique/i.test(msg) ? "Já existe uma categoria ou grupo com esse nome." : `Não salvou: ${msg}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        id={id}
        aria-label="Categoria"
        className={className}
        value={valor}
        onChange={(e) => (e.target.value === NOVA ? abrir() : aoMudar(e.target.value))}
      >
        <option value="">Sem categoria</option>
        {grupos.map((g) => (
          <optgroup key={g.id} label={g.nome}>
            {dados.categorias.filter((c) => c.grupo_id === g.id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </optgroup>
        ))}
        <option value={NOVA}>+ Nova categoria…</option>
      </select>
      {criando && (
        <div className="space-y-2 rounded-xl border border-tinta/10 p-3">
          <div className="text-sm font-medium">Nova categoria</div>
          <input autoFocus className="campo py-2" placeholder="Ex.: Material escolar" value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvarNova()} aria-label="Nome da nova categoria" />
          <select className="campo py-2" value={grupoId} onChange={(e) => setGrupoId(e.target.value)} aria-label="Grupo da nova categoria">
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
            <option value={NOVO_GRUPO}>+ Novo grupo…</option>
          </select>
          {grupoId === NOVO_GRUPO && (
            <input className="campo py-2" placeholder="Nome do novo grupo" value={nomeGrupo} onChange={(e) => setNomeGrupo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && salvarNova()} aria-label="Nome do novo grupo" />
          )}
          {erro && <p className="rounded-xl bg-vermelho-claro px-3 py-2 text-sm text-vermelho">{erro}</p>}
          <div className="flex gap-2">
            <button className="botao-secundario py-2" onClick={() => setCriando(false)} disabled={salvando}>Cancelar</button>
            <button className="botao-secundario flex-1 py-2" onClick={salvarNova} disabled={salvando}>{salvando ? "Salvando…" : "Criar e usar"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
