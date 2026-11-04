"use client";

// Painel: tudo numa tela só, sem rolar. Detalhes abrem com um toque.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { nomeMes, somarMeses, type Mes } from "@/lib/fatura";
import { dataCurta, hoje, reais } from "@/lib/formato";
import {
  limitesDosCartoes,
  noMes,
  pendenteAteFimDoMes,
  resumoDoMes,
  situacaoDasContas,
  type ResumoMes,
  type SituacaoConta,
} from "@/lib/painel";
import { sugerirRecorrentes } from "@/lib/recorrentes";

function mesAtual(): Mes {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

function tom(sobra: number, base: number) {
  if (sobra < 0) return { fundo: "bg-vermelho-claro", texto: "text-vermelho", frase: "Vai faltar" };
  if (sobra < base * 0.1) return { fundo: "bg-amarelo-claro", texto: "text-amarelo", frase: "Apertado" };
  return { fundo: "bg-verde-claro", texto: "text-verde", frase: "Vai sobrar" };
}

/** Valor sem centavos, para caber nos quadrinhos. */
const curto = (v: number) => reais(Math.round(v)).replace(/,00$/, "");

export default function Painel() {
  const { dados, eu } = useSessao();
  const dia = hoje();
  const atual = mesAtual();
  const seguinte = somarMeses(atual, 1);
  const base = { ...dados, hoje: dia };
  const rAtual = resumoDoMes(atual, base);
  const rSeguinte = resumoDoMes(seguinte, base);
  const [aberto, setAberto] = useState<"atual" | "seguinte">("atual");
  const detalhe = aberto === "atual" ? rAtual : rSeguinte;

  return (
    <Pagina larga>
      <div className="mb-3 flex items-baseline justify-between lg:mb-6">
        <h1 className="text-xl font-semibold lg:text-2xl">Olá, {eu.nome}</h1>
        <span className="text-sm text-tinta/50">hoje {dataCurta(dia)}</span>
      </div>

      {/* No computador: a conta do mês à esquerda, limites e saldos à direita */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <BlocoSobra r={rAtual} rotulo="Este mês" ativo={aberto === "atual"} onClick={() => setAberto("atual")} />
            <BlocoSobra r={rSeguinte} rotulo="Mês que vem" ativo={aberto === "seguinte"} onClick={() => setAberto("seguinte")} />
          </div>
          <Conta r={detalhe} hoje={dia} />
          <AvisoFixas />
        </div>
        <div>
          <Limites rAtual={rAtual} rSeguinte={rSeguinte} hoje={dia} />
        </div>
      </div>
    </Pagina>
  );
}

function BlocoSobra({ r, rotulo, ativo, onClick }: { r: ResumoMes; rotulo: string; ativo: boolean; onClick: () => void }) {
  const t = tom(r.sobra, r.recebido + r.aReceber);
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-2xl px-3 py-2.5 text-left transition ${t.fundo} ${ativo ? "ring-2 ring-tinta/80" : "ring-1 ring-tinta/5"}`}
    >
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{rotulo}</span>
        <span className="capitalize text-tinta/60">{nomeMes(r.mes)}</span>
      </div>
      <div className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums ${t.texto}`}>{curto(r.sobra)}</div>
      <div className="text-xs text-tinta/70">{t.frase}</div>
    </button>
  );
}

/**
 * A conta do mês escolhido: entrada prevista menos saída prevista dá a sobra.
 * "Já entrou" e "Já saiu" mostram quanto disso já aconteceu.
 */
function Conta({ r, hoje: dia }: { r: ResumoMes; hoje: string }) {
  const semFatura = r.itensFatura.some((f) => f.informado === null);
  const entrada = r.recebido + r.aReceber;
  const saida = r.gastoAVista + r.faturas + r.parcelas;
  const fixas = r.itensCompromisso.reduce((s, c) => s + Math.max(c.devido, c.pago), 0);
  const outros = saida - r.faturas - fixas;
  const deFontes = r.rendas.reduce((s, x) => s + x.recebido, 0);
  const outrasEntradas = r.recebido - deFontes;
  const ehAtual = noMes(dia, r.mes);
  const diaHoje = Number(dia.slice(8, 10));
  const faturasPagas = ehAtual
    ? r.itensFatura.filter((f) => f.cartao.dia_vencimento < diaHoje).reduce((s, f) => s + f.valor, 0)
    : 0;
  const saiu = r.gastoAVista + faturasPagas;

  return (
    <div className="cartao mb-3 p-0 text-sm">
      <div className="px-3 pt-2 text-xs font-medium text-tinta/50">Conta de {nomeMes(r.mes)}</div>

      <Abre rotulo="Entrada prevista" valor={entrada} cor="text-verde">
        {r.rendas.map((x) => (
          <Sub
            key={x.fonte.id}
            rotulo={`${x.fonte.nome}${x.falta > 0 ? (x.recebido > 0 ? ` · falta ${curto(x.falta)}` : " · ainda não entrou") : " · entrou"}`}
            valor={Math.max(x.previsto, x.recebido)}
          />
        ))}
        {Math.abs(outrasEntradas) >= 0.01 && <Sub rotulo="Outras entradas" valor={outrasEntradas} />}
      </Abre>
      <Ja rotulo="Já entrou" valor={r.recebido} />

      <Abre rotulo="Saída prevista" valor={-saida}>
        {r.itensFatura.map((f) => (
          <Sub
            key={f.cartao.id}
            rotulo={`Fatura ${f.cartao.nome} · dia ${f.cartao.dia_vencimento}${f.informado === null ? " · parcial" : ""}`}
            valor={-f.valor}
          />
        ))}
        {semFatura && (
          <p className="px-3 pb-1 pl-6 text-[11px] text-tinta/50">
            Digite a fatura do app do banco em <Link href="/cadastros" className="underline">Ajustes</Link> para o número ficar certo.
          </p>
        )}
        {r.itensCompromisso.map((c) => (
          <Sub
            key={c.compromisso.id}
            rotulo={`${c.compromisso.nome}${c.falta > 0 ? "" : " · pago"}`}
            valor={-Math.max(c.devido, c.pago)}
          />
        ))}
        {Math.abs(outros) >= 0.01 && <Sub rotulo="Outros gastos já lançados" valor={-outros} />}
        {r.itensCompromisso.length > 0 && (
          <p className="px-3 pb-1 pl-6 text-[11px] text-tinta/50">
            Para dar baixa numa parcela, use o <Link href="/lancamentos" className="underline">Extrato</Link>.
          </p>
        )}
      </Abre>
      <Ja rotulo="Já saiu" valor={-saiu} />

      <div className="flex items-center justify-between border-t border-tinta/10 px-3 py-2 font-semibold">
        <span>Sobra</span>
        <span className={`tabular-nums ${r.sobra < 0 ? "text-vermelho" : "text-verde"}`}>{reais(r.sobra)}</span>
      </div>
    </div>
  );
}

/** Linha pequena logo abaixo do previsto: quanto disso já aconteceu. */
function Ja({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between px-3 pb-1.5 pl-6 text-xs text-tinta/50">
      <span>{rotulo}</span>
      <span className="tabular-nums">{reais(valor)}</span>
    </div>
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

/** No computador há espaço: os detalhes já começam abertos. */
function useTelaGrande() {
  const [grande, setGrande] = useState(false);
  useEffect(() => setGrande(window.matchMedia("(min-width: 1024px)").matches), []);
  return grande;
}

function Abre({ rotulo, valor, cor, children }: { rotulo: string; valor: number; cor?: string; children?: React.ReactNode }) {
  const grande = useTelaGrande();
  const linha = (
    <>
      <span className="flex items-center gap-1">
        {rotulo}
        {children && <span aria-hidden className="text-tinta/30 transition group-open:rotate-90">›</span>}
      </span>
      <span className={`tabular-nums ${cor ?? ""}`}>{reais(valor)}</span>
    </>
  );
  if (!children) {
    return <div className="flex items-center justify-between border-t border-tinta/5 px-3 py-1.5">{linha}</div>;
  }
  return (
    <details open={grande || undefined} className="group border-t border-tinta/5">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-1.5 [&::-webkit-details-marker]:hidden">{linha}</summary>
      <div className="pb-1">{children}</div>
    </details>
  );
}

function Sub({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-0.5 pl-6 text-xs text-tinta/60">
      <span>{rotulo}</span>
      <span className="shrink-0 tabular-nums">{reais(valor)}</span>
    </div>
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
          <div key={l.cartao.id} className="cartao px-2.5 py-2">
            <div className="truncate text-xs text-tinta/60">{l.cartao.nome.replace(" Visa Gold", "")}</div>
            <div className={`text-sm font-semibold tabular-nums ${l.livre < 0 ? "text-vermelho" : ""}`}>{curto(l.livre)} livre</div>
            <Barra usado={l.usado} total={l.limite} />
            <div className="mt-0.5 text-[10px] text-tinta/50">usando {curto(l.usado)} de {curto(l.limite)}</div>
          </div>
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
  const nome = `Cheque ${c.conta.nome.replace(/^Conta\s+/i, "")}`;
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
    <div className={`rounded-2xl px-2.5 py-2 shadow-sm ring-1 ${emUso ? "bg-vermelho text-white ring-vermelho" : "bg-white ring-tinta/5"}`}>
      <div className={`truncate text-xs ${emUso ? "text-white/85" : "text-tinta/60"}`}>{nome}</div>
      <div className="text-sm font-semibold tabular-nums">{curto(c.chequeLivre ?? 0)} livre</div>
      <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${emUso ? "bg-white/30" : "bg-tinta/10"}`}>
        <div className="h-full rounded-full bg-white" style={{ width: `${p}%` }} />
      </div>
      <div className={`mt-0.5 text-[10px] ${emUso ? "text-white/85" : "text-tinta/50"}`}>
        {emUso ? `usando ${curto(c.chequeEmUso)} de ${curto(limite)}` : "sem uso"}
      </div>
    </div>
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
