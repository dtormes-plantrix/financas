"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { excluir, salvar } from "@/lib/dados";
import { nomeMes, parcelasDaCompra } from "@/lib/fatura";
import { hoje, lerValor, NOME_DONO, NOME_FORMA, reais } from "@/lib/formato";
import type { Dono, Forma, Lancamento, TipoLancamento } from "@/lib/tipos";

const FORMAS: Forma[] = ["pix", "credito", "debito", "dinheiro"];
const CHAVE_ULTIMO = "financas-ultimo";

type Ultimo = { forma?: Forma; cartao_id?: string; conta_id?: string };

function lerUltimo(apelido: string): Ultimo {
  try {
    return JSON.parse(localStorage.getItem(`${CHAVE_ULTIMO}-${apelido}`) || "{}");
  } catch {
    return {};
  }
}

function gravarUltimo(apelido: string, u: Ultimo) {
  try {
    localStorage.setItem(`${CHAVE_ULTIMO}-${apelido}`, JSON.stringify(u));
  } catch {}
}

export default function PaginaLancar() {
  return (
    <Suspense>
      <Lancar />
    </Suspense>
  );
}

function Lancar() {
  const { dados, eu, recarregar } = useSessao();
  const router = useRouter();
  const editarId = useSearchParams().get("id");
  const editando = dados.lancamentos.find((l) => l.id === editarId);

  const cartoes = dados.cartoes.filter((c) => c.ativo);
  const contas = dados.contas.filter((c) => c.ativo);
  const minhaConta = contas.find((c) => c.dono === eu.apelido) ?? contas[0];
  const meuCartao = cartoes.find((c) => c.dono === eu.apelido) ?? cartoes[0];

  const [tipo, setTipo] = useState<TipoLancamento>("saida");
  const [valorTexto, setValorTexto] = useState("");
  const [forma, setForma] = useState<Forma>("pix");
  const [cartaoId, setCartaoId] = useState<string | undefined>(meuCartao?.id);
  const [contaId, setContaId] = useState<string | undefined>(minhaConta?.id);
  const [parcelas, setParcelas] = useState(1);
  const [fonteId, setFonteId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [data, setData] = useState(hoje());
  const [deQuem, setDeQuem] = useState<Dono>("casa");
  const [maisDetalhes, setMaisDetalhes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const campoValor = useRef<HTMLInputElement>(null);

  // Começa com o que a pessoa usou da última vez, ou com o lançamento sendo editado.
  useEffect(() => {
    if (editando) {
      setTipo(editando.tipo);
      setValorTexto(String(editando.valor).replace(".", ","));
      setForma(editando.forma);
      setCartaoId(editando.cartao_id ?? meuCartao?.id);
      setContaId(editando.conta_id ?? minhaConta?.id);
      setParcelas(editando.parcelas);
      setFonteId(editando.fonte_id);
      setDescricao(editando.descricao ?? "");
      setCategoriaId(editando.categoria_id ?? "");
      setData(editando.data);
      setDeQuem(editando.de_quem);
      setMaisDetalhes(true);
      return;
    }
    const u = lerUltimo(eu.apelido);
    if (u.forma) setForma(u.forma);
    if (u.cartao_id && cartoes.some((c) => c.id === u.cartao_id)) setCartaoId(u.cartao_id);
    if (u.conta_id && contas.some((c) => c.id === u.conta_id)) setContaId(u.conta_id);
    campoValor.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editarId]);

  const valor = lerValor(valorTexto);
  const cartao = cartoes.find((c) => c.id === cartaoId);
  const ehCredito = tipo === "saida" && forma === "credito";

  const previa = useMemo(() => {
    if (!ehCredito || !cartao || valor <= 0) return null;
    const p = parcelasDaCompra(data, valor, parcelas, cartao);
    const primeira = p[0];
    const texto = `Vai para a fatura de ${nomeMes(primeira.fatura)} (vence dia ${cartao.dia_vencimento})`;
    return parcelas > 1 ? `${texto}. ${parcelas}x de ${reais(p[p.length - 1].valor)}, até ${nomeMes(p[p.length - 1].fatura, true)}.` : texto + ".";
  }, [ehCredito, cartao, valor, parcelas, data]);

  async function aoSalvar() {
    if (valor <= 0) {
      campoValor.current?.focus();
      return;
    }
    setSalvando(true);
    const formaFinal: Forma = tipo === "entrada" && forma === "credito" ? "pix" : forma;
    const registro: Partial<Lancamento> = {
      id: editando?.id,
      tipo,
      valor,
      data,
      descricao: descricao.trim() || null,
      forma: formaFinal,
      conta_id: formaFinal === "credito" ? null : contaId ?? null,
      cartao_id: formaFinal === "credito" ? cartaoId ?? null : null,
      parcelas: formaFinal === "credito" ? parcelas : 1,
      fonte_id: tipo === "entrada" ? fonteId : null,
      categoria_id: categoriaId || null,
      de_quem: deQuem,
    };
    try {
      await salvar("lancamentos", registro);
      gravarUltimo(eu.apelido, { forma: formaFinal, cartao_id: cartaoId, conta_id: contaId });
      await recarregar();
      if (editando) {
        router.push("/lancamentos");
        return;
      }
      setAviso(previa ? `Salvo! ${previa}` : "Salvo!");
      setValorTexto("");
      setDescricao("");
      setParcelas(1);
      setFonteId(null);
      setCategoriaId("");
      campoValor.current?.focus();
      setTimeout(() => setAviso(null), 4000);
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
    router.push("/lancamentos");
  }

  return (
    <Pagina>
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-white p-1 ring-1 ring-tinta/10">
        {(["saida", "entrada"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`rounded-xl py-3 text-base font-semibold ${tipo === t ? (t === "saida" ? "bg-vermelho text-white" : "bg-verde text-white") : "text-tinta/60"}`}
          >
            {t === "saida" ? "Saiu" : "Entrou"}
          </button>
        ))}
      </div>

      <label className="rotulo" htmlFor="valor">Valor</label>
      <div className="mb-5 flex items-center rounded-2xl bg-white px-4 ring-1 ring-tinta/15 focus-within:ring-2 focus-within:ring-tinta">
        <span className="text-2xl text-tinta/40">R$</span>
        <input
          id="valor"
          ref={campoValor}
          inputMode="decimal"
          placeholder="0,00"
          value={valorTexto}
          onChange={(e) => setValorTexto(e.target.value)}
          className="w-full bg-transparent px-3 py-4 text-4xl font-bold tabular-nums outline-none"
        />
      </div>

      <span className="rotulo">{tipo === "saida" ? "Como pagou" : "Como recebeu"}</span>
      <div className="mb-5 flex flex-wrap gap-2">
        {FORMAS.filter((f) => tipo === "saida" || f !== "credito").map((f) => (
          <button key={f} onClick={() => setForma(f)} className={`chip ${forma === f ? "chip-ativo" : ""}`}>
            {NOME_FORMA[f]}
          </button>
        ))}
      </div>

      {ehCredito ? (
        <>
          <span className="rotulo">Qual cartão</span>
          <div className="mb-5 flex flex-wrap gap-2">
            {cartoes.map((c) => (
              <button key={c.id} onClick={() => setCartaoId(c.id)} className={`chip ${cartaoId === c.id ? "chip-ativo" : ""}`}>
                {c.nome} <span className="opacity-60">· {NOME_DONO[c.dono]}</span>
              </button>
            ))}
          </div>

          <span className="rotulo">Parcelas</span>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {[1, 2, 3, 6, 10, 12].map((n) => (
              <button key={n} onClick={() => setParcelas(n)} className={`chip px-3 ${parcelas === n ? "chip-ativo" : ""}`}>
                {n}x
              </button>
            ))}
            <input
              aria-label="Outro número de parcelas"
              inputMode="numeric"
              value={[1, 2, 3, 6, 10, 12].includes(parcelas) ? "" : parcelas}
              placeholder="outro"
              onChange={(e) => setParcelas(Math.min(48, Math.max(1, Number(e.target.value) || 1)))}
              className="campo w-20 px-2 py-2.5 text-center"
            />
          </div>
          {previa && <p className="mb-5 rounded-xl bg-amarelo-claro px-4 py-3 text-sm">{previa}</p>}
        </>
      ) : (
        contas.length > 1 && (
          <>
            <span className="rotulo">Qual conta</span>
            <div className="mb-5 flex flex-wrap gap-2">
              {contas.map((c) => (
                <button key={c.id} onClick={() => setContaId(c.id)} className={`chip ${contaId === c.id ? "chip-ativo" : ""}`}>
                  {c.nome}
                </button>
              ))}
            </div>
          </>
        )
      )}

      {tipo === "entrada" && (
        <>
          <span className="rotulo">De onde veio</span>
          <div className="mb-5 flex flex-wrap gap-2">
            {dados.fontes.filter((f) => f.ativo).map((f) => (
              <button key={f.id} onClick={() => setFonteId(fonteId === f.id ? null : f.id)} className={`chip ${fonteId === f.id ? "chip-ativo" : ""}`}>
                {f.nome}
              </button>
            ))}
          </div>
        </>
      )}

      <button onClick={() => setMaisDetalhes(!maisDetalhes)} className="mb-4 text-sm font-medium text-tinta/60 underline">
        {maisDetalhes ? "Menos detalhes" : "Descrição, categoria, data…"}
      </button>

      {maisDetalhes && (
        <div className="mb-5 space-y-4">
          <div>
            <label className="rotulo" htmlFor="descricao">Descrição</label>
            <input id="descricao" className="campo" placeholder="Ex.: mercado, posto, farmácia" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="categoria">Categoria (opcional)</label>
            <select id="categoria" className="campo" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Sem categoria</option>
              {dados.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="data">Data</label>
            <input id="data" type="date" className="campo" value={data} onChange={(e) => setData(e.target.value || hoje())} />
          </div>
          <div>
            <span className="rotulo">De quem é</span>
            <div className="flex gap-2">
              {(["casa", "diego", "jo"] as const).map((d) => (
                <button key={d} onClick={() => setDeQuem(d)} className={`chip ${deQuem === d ? "chip-ativo" : ""}`}>
                  {NOME_DONO[d]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button className="botao-principal" onClick={aoSalvar} disabled={salvando || valor <= 0}>
        {salvando ? "Salvando…" : editando ? "Salvar alteração" : "Salvar"}
      </button>
      {editando && (
        <button onClick={aoExcluir} className="mt-3 w-full py-3 text-vermelho">Apagar lançamento</button>
      )}

      {aviso && (
        <div role="status" className="fixed inset-x-4 bottom-28 z-30 mx-auto max-w-md rounded-2xl bg-tinta px-4 py-3 text-white shadow-lg">
          {aviso}
        </div>
      )}
    </Pagina>
  );
}
