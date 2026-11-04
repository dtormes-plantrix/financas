"use client";

// Parcelas e contas fixas do mês, com o botão "Paguei". Fica no Extrato.

import Link from "next/link";
import { useState } from "react";
import { useSessao } from "@/components/Sessao";
import { salvar } from "@/lib/dados";
import { nomeMes, type Mes } from "@/lib/fatura";
import { hoje, lerValor, reais } from "@/lib/formato";
import { noMes, resumoDoMes, type ItemCompromisso } from "@/lib/painel";

const curto = (v: number) => reais(Math.round(v)).replace(/,00$/, "");

export function ParcelasDoMes({ mes }: { mes: Mes }) {
  const { dados } = useSessao();
  const r = resumoDoMes(mes, { ...dados, hoje: hoje() });
  if (r.itensCompromisso.length === 0) return null;
  return (
    <details className="cartao mb-4 p-0 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-medium">Parcelas e contas fixas de {nomeMes(mes)}</span>
        <span className="tabular-nums text-tinta/60">{r.parcelas > 0 ? `faltam ${curto(r.parcelas)}` : "tudo pago"}</span>
      </summary>
      <div className="border-t border-tinta/5 px-1 py-2">
        {r.itensCompromisso.map((c) => <ParcelaMensal key={c.compromisso.id} item={c} mes={mes} />)}
      </div>
    </details>
  );
}

/** Uma parcela mensal numa linha, com o botão "Paguei" e o valor pago editável. */
function ParcelaMensal({ item, mes }: { item: ItemCompromisso; mes: Mes }) {
  const { dados, eu, recarregar } = useSessao();
  const [pagando, setPagando] = useState(false);
  const [valorTexto, setValorTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const contas = dados.contas.filter((c) => c.ativo);
  const minhaConta = contas.find((c) => c.dono === eu.apelido) ?? contas[0];
  const [contaId, setContaId] = useState(minhaConta?.id);
  const pagamentos = dados.lancamentos.filter((l) => l.compromisso_id === item.compromisso.id && noMes(l.data, mes));
  const c = item.compromisso;

  function abrir() {
    setValorTexto(String(item.falta || item.devido).replace(".", ","));
    setPagando(true);
  }

  async function confirmar() {
    const valor = lerValor(valorTexto);
    if (valor <= 0) return;
    setSalvando(true);
    try {
      await salvar("lancamentos", {
        tipo: "saida",
        valor,
        data: hoje(),
        descricao: c.nome,
        forma: "pix",
        conta_id: contaId ?? null,
        cartao_id: null,
        parcelas: 1,
        fonte_id: null,
        categoria_id: null,
        de_quem: "casa",
        compromisso_id: c.id,
      });
      await recarregar();
      setPagando(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="py-0.5 pl-3 text-xs text-tinta/60">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">
          {c.nome.replace("Devolver poupança do ", "")} · {item.rotulo.replace("parcela ", "").replace(" de ", "/").replace("depois deste mês faltam", "restam")}
          {c.dia_vencimento ? ` · dia ${c.dia_vencimento}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {pagamentos.map((p) => (
            <Link key={p.id} href={`/lancar?id=${p.id}`} className="rounded bg-verde-claro px-1.5 py-0.5 text-verde">
              pago {curto(p.valor)} ✎
            </Link>
          ))}
          {item.falta > 0 && <span className="tabular-nums">{curto(-item.falta)}</span>}
          {!pagando && item.falta > 0 && noMes(hoje(), mes) && (
            <button onClick={abrir} className="rounded-md bg-tinta px-2 py-1 font-medium text-white">Paguei</button>
          )}
        </span>
      </div>

      {pagando && (
        <div className="mt-1 space-y-2 rounded-xl bg-papel p-2 text-sm text-tinta">
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-xs text-tinta/60" htmlFor={`pago-${c.id}`}>Quanto pagou</label>
            <div className="flex flex-1 items-center rounded-lg bg-white px-2 ring-1 ring-tinta/15">
              <span className="text-tinta/40">R$</span>
              <input
                id={`pago-${c.id}`}
                inputMode="decimal"
                autoFocus
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                className="w-full bg-transparent px-2 py-1.5 font-semibold outline-none"
              />
            </div>
          </div>
          {contas.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {contas.map((k) => (
                <button key={k.id} onClick={() => setContaId(k.id)} className={`chip px-3 py-1 text-xs ${contaId === k.id ? "chip-ativo" : ""}`}>
                  {k.nome}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={confirmar} disabled={salvando} className="rounded-lg bg-tinta px-3 py-1.5 font-medium text-white">
              {salvando ? "Salvando…" : "Confirmar"}
            </button>
            <button onClick={() => setPagando(false)} className="px-2 py-1.5 text-tinta/60">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
