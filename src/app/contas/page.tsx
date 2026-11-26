"use client";

// Calendário de contas: o que venceu, o que vence hoje, nos próximos 7 e 30 dias.
// Cada conta tem o botão "Marcar como paga".

import Link from "next/link";
import { useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { curto } from "@/components/Orcamento";
import { calendario, diasEntre, type ContaDoCalendario, type Faixa } from "@/lib/calendario";
import { marcarFaturaPaga, salvar } from "@/lib/dados";
import { chaveMes } from "@/lib/fatura";
import { dataCurta, hoje, lerValor } from "@/lib/formato";

const FAIXAS: { faixa: Faixa; titulo: string; cor: string; vazio: string }[] = [
  { faixa: "vencidas", titulo: "Vencidas", cor: "text-vermelho", vazio: "Nenhuma conta atrasada." },
  { faixa: "hoje", titulo: "Vencem hoje", cor: "text-amarelo", vazio: "Nada vence hoje." },
  { faixa: "semana", titulo: "Próximos 7 dias", cor: "text-tinta", vazio: "Nada nos próximos 7 dias." },
  { faixa: "mes", titulo: "Próximos 30 dias", cor: "text-tinta/70", vazio: "Nada nos próximos 30 dias." },
];

export default function Contas() {
  const { dados } = useSessao();
  const dia = hoje();
  const cal = calendario(dados, dia);

  return (
    <Pagina titulo="Contas a pagar" larga>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {FAIXAS.map((f) => (
          <a key={f.faixa} href={`#${f.faixa}`} className={`cartao block px-3 py-2 ${f.faixa === "vencidas" && cal.vencidas.length ? "bg-vermelho-claro" : ""}`}>
            <div className="text-xs text-tinta/60">{f.titulo}</div>
            <div className={`text-lg font-semibold tabular-nums ${cal[f.faixa].length ? f.cor : "text-tinta/40"}`}>{curto(cal.totais[f.faixa])}</div>
            <div className="text-[11px] text-tinta/50">
              {cal[f.faixa].length} {cal[f.faixa].length === 1 ? "conta" : "contas"}
            </div>
          </a>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {FAIXAS.map((f) => (
          <section key={f.faixa} id={f.faixa} className="mb-4 scroll-mt-4">
            <h2 className={`mb-1 px-1 text-sm font-semibold ${f.cor}`}>{f.titulo}</h2>
            {cal[f.faixa].length === 0 ? (
              <p className="cartao px-3 py-2 text-sm text-tinta/50">{f.vazio}</p>
            ) : (
              <div className="cartao divide-y divide-tinta/5 p-0">
                {cal[f.faixa].map((c) => <Linha key={c.chave} conta={c} hoje={dia} />)}
              </div>
            )}
          </section>
        ))}
      </div>

      {cal.pagas.length > 0 && (
        <details className="cartao mb-4 p-0 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">Já pagas neste mês</span>
            <span className="text-tinta/60">{cal.pagas.length} ›</span>
          </summary>
          <div className="divide-y divide-tinta/5 border-t border-tinta/5">
            {cal.pagas.map((c) => <Linha key={c.chave} conta={c} hoje={dia} />)}
          </div>
        </details>
      )}

      <p className="px-1 text-xs text-tinta/50">
        Entram aqui as faturas dos cartões, as parcelas e contas fixas (Ajustes › Contas que se repetem) e as despesas fixas do Studio e do Espaço,
        que se repetem no mesmo dia do mês anterior. Contas fixas no cartão já estão dentro da fatura.
      </p>
    </Pagina>
  );
}

function quando(vence: string, dia: string, semDia: boolean): string {
  if (semDia) return `até ${dataCurta(vence)}`;
  const d = diasEntre(dia, vence);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  if (d < 0) return `${dataCurta(vence)} · há ${-d} dias`;
  return `${dataCurta(vence)} · em ${d} dias`;
}

/** Uma conta numa linha, com o botão "Marcar como paga". */
function Linha({ conta: c, hoje: dia }: { conta: ContaDoCalendario; hoje: string }) {
  const { dados, eu, recarregar } = useSessao();
  const [abrindo, setAbrindo] = useState(false);
  const [valorTexto, setValorTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const contas = dados.contas.filter((k) => k.ativo);
  const padrao =
    c.modelo?.conta_id ?? c.compromisso?.conta_id ?? (contas.find((k) => k.dono === eu.apelido) ?? contas[0])?.id ?? null;
  const [contaId, setContaId] = useState<string | null>(padrao);

  function abrir() {
    setValorTexto(c.valor.toFixed(2).replace(".", ","));
    setErro("");
    setAbrindo(true);
  }

  async function gravar(acao: () => Promise<void>) {
    setSalvando(true);
    setErro("");
    try {
      await acao();
      await recarregar();
      setAbrindo(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmar() {
    const valor = lerValor(valorTexto);
    if (valor <= 0) return;
    gravar(async () => {
      if (c.tipo === "fatura" && c.cartao) {
        // pagar a fatura não é gasto novo: as compras já estão lançadas
        await marcarFaturaPaga(c.cartao.id, chaveMes(c.mes), valor, dia);
      } else if (c.tipo === "parcela" && c.compromisso) {
        await salvar("lancamentos", {
          tipo: "saida", valor, data: dia, descricao: c.compromisso.nome, forma: "pix",
          conta_id: contaId, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null,
          de_quem: "casa", compromisso_id: c.compromisso.id,
        });
      } else if (c.tipo === "negocio" && c.modelo && c.negocio) {
        const m = c.modelo;
        await salvar("lancamentos", {
          tipo: "saida", valor, data: dia, descricao: m.descricao, forma: m.forma === "credito" ? "pix" : m.forma,
          conta_id: contaId, cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: m.categoria_id,
          de_quem: m.de_quem, negocio_id: c.negocio.id, grupo: "fixa",
        });
      }
    });
  }

  const pediuConta = c.tipo !== "fatura" && contas.length > 1;

  return (
    <div className="px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{c.nome}</div>
          <div className="truncate text-xs text-tinta/55">
            {c.paga ? `vencia ${dataCurta(c.vence)}` : quando(c.vence, dia, c.semDia)} · {c.detalhe}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`tabular-nums ${c.paga ? "text-verde" : "font-semibold"}`}>{curto(c.valor)}</span>
          {!c.paga && !abrindo && (
            <button onClick={abrir} className="rounded-md bg-tinta px-2 py-1 text-xs font-medium text-white">
              <span className="lg:hidden">Paguei</span>
              <span className="hidden lg:inline">Marcar como paga</span>
            </button>
          )}
          {c.paga && c.tipo === "fatura" && c.cartao && (
            <button
              disabled={salvando}
              onClick={() => gravar(() => marcarFaturaPaga(c.cartao!.id, chaveMes(c.mes), c.valor, null))}
              className="text-xs text-tinta/60 underline"
            >
              desfazer
            </button>
          )}
          {c.paga && c.tipo !== "fatura" && c.pagamentos?.map((p) => (
            <Link key={p.id} href={`/lancar?id=${p.id}`} className="rounded bg-verde-claro px-1.5 py-0.5 text-xs text-verde">
              pago ✎
            </Link>
          ))}
        </div>
      </div>

      {abrindo && (
        <div className="mt-2 space-y-2 rounded-xl bg-papel p-2">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-xs text-tinta/60" htmlFor={`pago-${c.chave}`}>Quanto pagou</label>
            <div className="flex flex-1 items-center rounded-lg bg-white px-2 ring-1 ring-tinta/15">
              <span className="text-tinta/40">R$</span>
              <input
                id={`pago-${c.chave}`}
                inputMode="decimal"
                autoFocus
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                className="w-full bg-transparent px-2 py-1.5 font-semibold outline-none"
              />
            </div>
          </div>
          {pediuConta && (
            <div className="flex flex-wrap gap-1.5">
              {contas.map((k) => (
                <button key={k.id} onClick={() => setContaId(k.id)} className={`chip px-3 py-1 text-xs ${contaId === k.id ? "chip-ativo" : ""}`}>
                  {k.nome}
                </button>
              ))}
            </div>
          )}
          {c.tipo === "fatura" && (
            <p className="text-[11px] text-tinta/55">Pagar a fatura não entra como gasto: as compras dela já estão lançadas.</p>
          )}
          {erro && <p className="text-xs text-vermelho">{erro}</p>}
          <div className="flex gap-2">
            <button onClick={confirmar} disabled={salvando} className="rounded-lg bg-tinta px-3 py-1.5 font-medium text-white">
              {salvando ? "Salvando…" : "Confirmar"}
            </button>
            <button onClick={() => setAbrindo(false)} className="px-2 py-1.5 text-tinta/60">Cancelar</button>
          </div>
        </div>
      )}
      {!abrindo && erro && <p className="mt-1 text-xs text-vermelho">{erro}</p>}
    </div>
  );
}
