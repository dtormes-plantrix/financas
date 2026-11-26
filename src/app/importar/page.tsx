"use client";

// Importar extrato: a pessoa escolhe o PDF ou o OFX do extrato da conta ou da fatura do cartão,
// o app lê (sem IA, aqui mesmo no aparelho), mostra o que já está lançado e lança o que falta.

import Link from "next/link";
import { useMemo, useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { criarVarios } from "@/lib/dados";
import { conciliar, sugerirDestino, type Destino, type Linha } from "@/lib/extrato/conciliar";
import { lerArquivo, type ArquivoLido } from "@/lib/extrato/leitores";
import { decodificarOfx, ehOfx, lerOfx } from "@/lib/extrato/ofx";
import { textoDoPdf } from "@/lib/extrato/texto";
import { dataCurta, NOME_FORMA, reais } from "@/lib/formato";

async function lerPdf(arquivo: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  return textoDoPdf(new Uint8Array(await arquivo.arrayBuffer()), pdfjs as never);
}

export default function Importar() {
  const { dados, recarregar } = useSessao();
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [arq, setArq] = useState<ArquivoLido | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [desmarcados, setDesmarcados] = useState<Set<number>>(new Set());
  const [marcadosExtra, setMarcadosExtra] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState<number | null>(null);

  const linhas: Linha[] = useMemo(() => {
    if (!arq || !destino) return [];
    return conciliar(arq, destino, {
      contas: dados.contas,
      cartoes: dados.cartoes,
      fontes: dados.fontes,
      lancamentos: [...dados.lancamentos, ...dados.lancamentosNegocios],
    });
  }, [arq, destino, dados]);

  const marcado = (i: number) => (linhas[i].marcado ? !desmarcados.has(i) : marcadosExtra.has(i));
  const alternar = (i: number) => {
    const conjunto = linhas[i].marcado ? desmarcados : marcadosExtra;
    const novo = new Set(conjunto);
    if (novo.has(i)) novo.delete(i);
    else novo.add(i);
    if (linhas[i].marcado) setDesmarcados(novo);
    else setMarcadosExtra(novo);
  };

  const indices = (s: Linha["situacao"]) => linhas.map((l, i) => (l.situacao === s ? i : -1)).filter((i) => i >= 0);
  const faltam = indices("falta");
  const lancados = indices("lancado");
  const fora = indices("fora");
  const escolhidos = faltam.filter(marcado);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(null);
    setPronto(null);
    setArq(null);
    setLendo(true);
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const textoOfx = /\.(ofx|qfx)$/i.test(arquivo.name) || ehOfx(new TextDecoder("latin1").decode(bytes.slice(0, 2000))) ? decodificarOfx(bytes) : null;
      const lido = textoOfx ? lerOfx(textoOfx) : lerArquivo(await lerPdf(arquivo));
      if (!lido) {
        setErro(
          textoOfx
            ? "Não consegui ler esse OFX. Tente exportar de novo no app do banco (formato OFX ou Money)."
            : "Não reconheci esse PDF. O app lê o extrato da conta do Mercado Pago e do Sicredi e a fatura do cartão do Mercado Pago, do Sicredi e do Nubank. De outros bancos, use o arquivo OFX.",
        );
        return;
      }
      if (!lido.itens.length) {
        setErro("Reconheci o arquivo, mas não achei nenhuma linha com valor nele.");
        return;
      }
      setArq(lido);
      setDestino(sugerirDestino(lido, dados));
      setDesmarcados(new Set());
      setMarcadosExtra(new Set());
    } catch (e) {
      setErro(`Não consegui abrir esse arquivo. ${e instanceof Error ? e.message : ""}`.trim());
    } finally {
      setLendo(false);
    }
  }

  async function lancar() {
    const registros = escolhidos.map((i) => linhas[i].novo!).filter(Boolean);
    if (!registros.length) return;
    setSalvando(true);
    setErro(null);
    try {
      await criarVarios("lancamentos", registros);
      await recarregar();
      setDesmarcados(new Set());
      setMarcadosExtra(new Set());
      setPronto(registros.length);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErro(`Não consegui lançar. ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSalvando(false);
    }
  }

  const opcoes = arq?.tipo === "fatura" ? dados.cartoes : dados.contas;

  return (
    <Pagina>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Importar extrato</h1>
        <Link href="/lancamentos" className="text-sm underline">Voltar</Link>
      </div>

      <label className={`cartao mb-4 block cursor-pointer text-center ${lendo ? "opacity-60" : ""}`}>
        <input type="file" accept="application/pdf,.pdf,.ofx,.qfx,application/x-ofx,application/ofx" className="hidden" onChange={escolher} disabled={lendo} />
        <span className="block text-lg font-semibold">{lendo ? "Lendo o arquivo…" : arq ? "Escolher outro arquivo" : "Escolher o PDF ou OFX"}</span>
        <span className="mt-1 block text-sm text-tinta/60">
          OFX de qualquer banco (extrato ou fatura), ou PDF do Mercado Pago, Sicredi e Nubank. O app lê aqui no celular e mostra o
          que já foi lançado e o que falta. Pode importar o mesmo período de novo: o que já entrou não entra duas vezes.
        </span>
      </label>

      {erro && <p className="mb-4 rounded-xl bg-vermelho-claro p-3 text-sm text-vermelho">{erro}</p>}

      {pronto !== null && (
        <p className="mb-4 rounded-xl bg-verde-claro p-3 text-sm text-verde">
          Pronto! {pronto === 1 ? "1 lançamento entrou" : `${pronto} lançamentos entraram`}. Eles aparecem no{" "}
          <Link href="/lancamentos" className="underline">Extrato</Link> com a etiqueta &quot;do extrato&quot;; toque em um para pôr categoria.
        </p>
      )}

      {arq && (
        <>
          <div className="cartao mb-4">
            <div className="font-semibold">{arq.titulo}</div>
            <div className={`mt-1 text-sm ${arq.confere ? "text-verde" : arq.semTotal ? "text-tinta/60" : "text-amarelo"}`}>
              {arq.semTotal
                ? `Li ${arq.itens.length} linhas. O arquivo não traz um total para conferir; cada transação tem o código do banco, então nada entra duas vezes.`
                : arq.confere
                ? `✓ Li ${arq.itens.length} linhas e a conta bate com o banco (${reais(arq.totalDoBanco)})`
                : `Atenção: li ${arq.itens.length} linhas, mas a soma deu ${reais(arq.soma)} e o banco diz ${reais(arq.totalDoBanco)}. Confira antes de lançar.`}
            </div>
            <label htmlFor="destino" className="rotulo mt-3">{arq.tipo === "fatura" ? "Cartão" : "Conta"}</label>
            <select
              id="destino"
              className="campo"
              value={destino?.id ?? ""}
              onChange={(e) => {
                setDestino(e.target.value ? { tipo: arq.tipo === "fatura" ? "cartao" : "conta", id: e.target.value } : null);
                setDesmarcados(new Set());
                setMarcadosExtra(new Set());
              }}
            >
              <option value="">Escolha…</option>
              {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>

          {destino && (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <Resumo numero={faltam.length} rotulo="Faltam lançar" cor={faltam.length ? "text-vermelho" : "text-verde"} />
                <Resumo numero={lancados.length} rotulo="Já lançados" cor="text-verde" />
                <Resumo numero={fora.length} rotulo="Fora da conta" cor="text-tinta/60" />
              </div>

              {faltam.length === 0 ? (
                <p className="cartao mb-4 text-center text-verde">Tudo que está neste arquivo já está lançado. 🎉</p>
              ) : (
                <section className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-semibold">Faltam lançar</h2>
                    <button
                      className="text-sm underline"
                      onClick={() => {
                        const todos = escolhidos.length === faltam.length;
                        setDesmarcados(todos ? new Set(faltam.filter((i) => linhas[i].marcado)) : new Set());
                        setMarcadosExtra(todos ? new Set() : new Set(faltam.filter((i) => !linhas[i].marcado)));
                      }}
                    >
                      {escolhidos.length === faltam.length ? "Desmarcar todos" : "Marcar todos"}
                    </button>
                  </div>
                  <div className="cartao divide-y divide-tinta/5 p-0">
                    {faltam.map((i) => (
                      <LinhaItem key={i} linha={linhas[i]} marcado={marcado(i)} alternar={() => alternar(i)} nomes={dados} />
                    ))}
                  </div>
                </section>
              )}

              {lancados.length > 0 && (
                <details className="mb-4">
                  <summary className="mb-2 cursor-pointer font-semibold">Já lançados ({lancados.length})</summary>
                  <div className="cartao divide-y divide-tinta/5 p-0">
                    {lancados.map((i) => <LinhaItem key={i} linha={linhas[i]} nomes={dados} />)}
                  </div>
                </details>
              )}

              {fora.length > 0 && (
                <details className="mb-4">
                  <summary className="mb-2 cursor-pointer font-semibold">Fora da conta ({fora.length})</summary>
                  <p className="mb-2 text-sm text-tinta/60">Pagamento de fatura, rendimentos e estornos não contam como gasto nem como renda.</p>
                  <div className="cartao divide-y divide-tinta/5 p-0">
                    {fora.map((i) => <LinhaItem key={i} linha={linhas[i]} nomes={dados} />)}
                  </div>
                </details>
              )}

              {faltam.length > 0 && (
                <div className="sticky bottom-24 z-10 mt-4">
                  <button className="botao-principal shadow-lg" disabled={!escolhidos.length || salvando} onClick={lancar}>
                    {salvando
                      ? "Lançando…"
                      : escolhidos.length
                        ? `Lançar ${escolhidos.length === 1 ? "1 lançamento" : `${escolhidos.length} lançamentos`}`
                        : "Marque o que quer lançar"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Pagina>
  );
}

function Resumo({ numero, rotulo, cor }: { numero: number; rotulo: string; cor: string }) {
  return (
    <div className="cartao px-2 py-3">
      <div className={`text-2xl font-semibold ${cor}`}>{numero}</div>
      <div className="text-xs text-tinta/60">{rotulo}</div>
    </div>
  );
}

type Nomes = { contas: { id: string; nome: string }[]; categorias: { id: string; nome: string }[]; fontes: { id: string; nome: string }[] };

function LinhaItem({ linha, marcado, alternar, nomes }: { linha: Linha; marcado?: boolean; alternar?: () => void; nomes: Nomes }) {
  const { item, novo, lancamento, motivo } = linha;
  const nome = (id: string | null | undefined, de: { id: string; nome: string }[]) => de.find((x) => x.id === id)?.nome;
  const entra = item.sinal === "entra";
  let detalhe: string;
  if (novo) {
    if (novo.tipo === "transferencia") detalhe = `Entre contas · ${nome(novo.conta_id, nomes.contas) ?? "?"} → ${nome(novo.conta_destino_id, nomes.contas) ?? "?"}`;
    else {
      const extra = nome(novo.fonte_id, nomes.fontes) ?? nome(novo.categoria_id, nomes.categorias);
      detalhe = `${novo.tipo === "entrada" ? "Entrou" : "Saiu"} · ${NOME_FORMA[novo.forma]}${novo.parcelas > 1 ? ` · ${novo.parcelas}x, total ${reais(novo.valor)}` : ""}${extra ? ` · ${extra}` : ""}`;
    }
  } else if (lancamento) {
    detalhe = `Lançado em ${dataCurta(lancamento.data)}${lancamento.descricao ? ` como "${lancamento.descricao}"` : ""}`;
  } else {
    detalhe = motivo ?? "";
  }
  const conteudo = (
    <>
      {alternar && (
        <span
          aria-hidden
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${marcado ? "bg-tinta text-white ring-tinta" : "bg-white ring-tinta/30"}`}
        >
          {marcado ? "✓" : ""}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.descricao}</span>
        <span className="block text-xs text-tinta/50">
          {dataCurta(item.data)}
          {item.parcela ? ` · parcela ${item.parcela.numero}/${item.parcela.de}` : ""} · {detalhe}
        </span>
        {novo && motivo && <span className="mt-0.5 block text-xs text-amarelo">{motivo}</span>}
      </span>
      <span className={`shrink-0 font-medium tabular-nums ${entra ? "text-verde" : ""}`}>
        {entra ? "+" : "−"} {reais(item.valor)}
      </span>
    </>
  );
  return alternar ? (
    <button type="button" onClick={alternar} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-tinta/5">
      {conteudo}
    </button>
  ) : (
    <div className="flex items-start gap-3 px-4 py-3 opacity-80">{conteudo}</div>
  );
}
