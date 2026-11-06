"use client";

// Painel: só o resumo, numa tela só. A conta linha a linha fica em Detalhes do mês (/mes).

import Link from "next/link";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { BlocoOrcamento, curto, tom, useResumos } from "@/components/Orcamento";
import { nomeMes } from "@/lib/fatura";
import { dataCurta, hoje } from "@/lib/formato";
import { ritmoDoMes } from "@/lib/orcamento";
import {
  limitesDosCartoes,
  pendenteAteFimDoMes,
  situacaoDasContas,
  type ResumoMes,
  type SituacaoConta,
} from "@/lib/painel";
import { sugerirRecorrentes } from "@/lib/recorrentes";

export default function Painel() {
  const { eu } = useSessao();
  const { dia, orcamento, rAtual, rSeguinte } = useResumos();

  return (
    <Pagina larga>
      <div className="mb-3 flex items-baseline justify-between lg:mb-6">
        <h1 className="text-xl font-semibold lg:text-2xl">Olá, {eu.nome}</h1>
        <span className="text-sm text-tinta/50">hoje {dataCurta(dia)}</span>
      </div>

      {/* No computador: sobra e orçamento à esquerda, limites e saldos à direita */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>
          <div className="mb-1 grid grid-cols-2 gap-2">
            <BlocoSobra r={rAtual} rotulo="Este mês" href="/mes?m=atual" />
            <BlocoSobra r={rSeguinte} rotulo="Mês que vem" href="/mes?m=seguinte" />
          </div>
          <Link href="/mes" className="mb-3 block px-1 text-right text-xs text-tinta/60 underline">
            Ver detalhes do mês
          </Link>
          <BlocoOrcamento itens={orcamento} ritmo={ritmoDoMes(rAtual.mes, dia)} mes={rAtual.mes} titulo={`Orçamento de ${nomeMes(rAtual.mes)}`} />
          <AvisoFixas />
        </div>
        <div>
          <Limites rAtual={rAtual} rSeguinte={rSeguinte} hoje={dia} />
        </div>
      </div>
    </Pagina>
  );
}

function BlocoSobra({ r, rotulo, href }: { r: ResumoMes; rotulo: string; href: string }) {
  const t = tom(r.sobra, r.recebido + r.aReceber);
  return (
    <Link href={href} className={`rounded-2xl px-3 py-2.5 text-left ring-1 ring-tinta/5 transition active:scale-[0.98] ${t.fundo}`}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{rotulo}</span>
        <span className="capitalize text-tinta/60">{nomeMes(r.mes)}</span>
      </div>
      <div className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${t.texto}`}>{curto(r.sobra)}</div>
      <div className="text-xs text-tinta/70">{t.frase} ›</div>
    </Link>
  );
}

/** Lembra de confirmar as contas que se repetem, para o mês que vem sair certo. */
function AvisoFixas() {
  const { dados } = useSessao();
  const n = sugerirRecorrentes(dados.lancamentos, dados.compromissos, hoje()).length;
  if (n === 0) return null;
  return (
    <Link href="/cadastros#fixas" className="mb-3 block rounded-2xl bg-amarelo-claro px-3 py-2 text-sm">
      {n} {n > 1 ? "contas parecem se repetir" : "conta parece se repetir"} todo mês. <span className="underline">Confirmar</span>
    </Link>
  );
}

function Barra({ usado, total }: { usado: number; total: number }) {
  const p = total > 0 ? Math.min(100, Math.max(0, (usado / total) * 100)) : 0;
  const cor = p >= 90 ? "bg-vermelho" : p >= 70 ? "bg-amarelo" : "bg-verde";
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tinta/10" role="meter" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${p}%` }} />
    </div>
  );
}

function Limites({ rAtual, rSeguinte, hoje: dia }: { rAtual: ResumoMes; rSeguinte: ResumoMes; hoje: string }) {
  const { dados } = useSessao();
  const cartoes = limitesDosCartoes(dados.cartoes, dados.lancamentos, dia);
  const contas = situacaoDasContas(dados.contas, dados.lancamentos);
  const comSaldo = contas.filter((c) => c.saldo !== null);
  const saldoHoje = comSaldo.reduce((s, c) => s + (c.saldo ?? 0), 0);
  const fimMes = saldoHoje + pendenteAteFimDoMes(rAtual, dia);
  const fimSeguinte = fimMes + rSeguinte.sobra;
  const limiteCheque = contas.reduce((s, c) => s + (Number(c.conta.limite_cheque_especial) || 0), 0);

  return (
    <>
      <div className="mb-1 flex items-baseline justify-between px-1 text-xs font-medium text-tinta/50">
        <span>Limite livre dos cartões e do cheque especial</span>
        <Link href="/cadastros" className="underline">atualizar</Link>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {cartoes.map((l) => (
          <Link key={l.cartao.id} href={`/lancamentos?onde=cartao:${l.cartao.id}&todos=1`} className="cartao block px-2.5 py-2">
            <div className="truncate text-xs text-tinta/60">{l.cartao.nome.replace(" Visa Gold", "")}</div>
            <div className={`text-sm font-semibold tabular-nums ${l.livre < 0 ? "text-vermelho" : ""}`}>{curto(l.livre)} livre</div>
            <Barra usado={l.usado} total={l.limite} />
            <div className="mt-0.5 text-[10px] text-tinta/50">usando {curto(l.usado)} de {curto(l.limite)}</div>
          </Link>
        ))}
        {contas.filter((c) => c.conta.limite_cheque_especial).map((c) => <ChequeEspecial key={c.conta.id} c={c} />)}
      </div>

      {comSaldo.length > 0 && (
        <div className="cartao px-3 py-2">
          <div className="mb-1 text-xs font-medium text-tinta/50">Dinheiro nas contas (saldo de hoje + o que ainda vai entrar e sair)</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Projecao rotulo="Hoje" valor={saldoHoje} limite={limiteCheque} />
            <Projecao rotulo={`Fim de ${nomeMes(rAtual.mes)}`} valor={fimMes} limite={limiteCheque} />
            <Projecao rotulo={`Fim de ${nomeMes(rSeguinte.mes)}`} valor={fimSeguinte} limite={limiteCheque} />
          </div>
          {comSaldo.length < contas.length && (
            <p className="mt-1 text-[10px] text-tinta/50">Falta informar o saldo de alguma conta em Ajustes.</p>
          )}
        </div>
      )}
    </>
  );
}

/** Quadrinho do cheque especial, ao lado dos cartões. Fica vermelho quando está em uso. */
function ChequeEspecial({ c }: { c: SituacaoConta }) {
  const limite = Number(c.conta.limite_cheque_especial);
  const nomeConta = c.conta.nome.replace(/^Conta\s+/i, "");
  const nome = `Cheque ${nomeConta}`;
  if (c.saldo === null) {
    return (
      <Link href="/cadastros" className="cartao px-2.5 py-2 text-xs text-tinta/60">
        <div className="truncate">{nome}</div>
        <div className="mt-1 underline">informar o saldo</div>
      </Link>
    );
  }
  const emUso = c.chequeEmUso > 0;
  const p = limite ? Math.min(100, (c.chequeEmUso / limite) * 100) : 0;
  return (
    <Link href={`/lancamentos?onde=conta:${c.conta.id}`} className={`block rounded-2xl px-2.5 py-2 shadow-sm ring-1 ${emUso ? "bg-vermelho text-white ring-vermelho" : "bg-white ring-tinta/5"}`}>
      <div className={`truncate text-xs ${emUso ? "text-white/85" : "text-tinta/60"}`}>{emUso ? nome : `Saldo ${nomeConta}`}</div>
      <div className="text-sm font-semibold tabular-nums">{emUso ? `${curto(c.chequeLivre ?? 0)} livre` : curto(c.saldo)}</div>
      <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${emUso ? "bg-white/30" : "bg-tinta/10"}`}>
        <div className="h-full rounded-full bg-white" style={{ width: `${p}%` }} />
      </div>
      <div className={`mt-0.5 text-[10px] ${emUso ? "text-white/85" : "text-tinta/50"}`}>
        {emUso ? `usando ${curto(c.chequeEmUso)} de ${curto(limite)}` : `cheque sem uso · ${curto(limite)} livre`}
      </div>
    </Link>
  );
}

function Projecao({ rotulo, valor, limite }: { rotulo: string; valor: number; limite: number }) {
  const emUso = Math.max(0, -valor);
  return (
    <div className={`rounded-lg py-1 ${valor < 0 ? "bg-vermelho-claro" : "bg-verde-claro"}`}>
      <div className="text-[10px] text-tinta/60">{rotulo}</div>
      <div className={`text-sm font-semibold tabular-nums ${valor < 0 ? "text-vermelho" : "text-verde"}`}>{curto(valor)}</div>
      {emUso > 0 && limite > 0 && (
        <div className="text-[10px] text-vermelho">
          {emUso > limite ? "passa do limite" : `${Math.round((emUso / limite) * 100)}% do cheque`}
        </div>
      )}
    </div>
  );
}
