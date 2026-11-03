"use client";

// Painel: tudo numa tela só, sem rolar. Detalhes abrem com um toque.

import Link from "next/link";
import { useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { salvar } from "@/lib/dados";
import { nomeMes, somarMeses, type Mes } from "@/lib/fatura";
import { dataCurta, hoje, lerValor, reais } from "@/lib/formato";
import {
  limitesDosCartoes,
  noMes,
  pendenteAteFimDoMes,
  resumoDoMes,
  situacaoDasContas,
  type ItemCompromisso,
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
    <Pagina>
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Olá, {eu.nome}</h1>
        <span className="text-sm text-tinta/50">hoje {dataCurta(dia)}</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <BlocoSobra r={rAtual} rotulo="Este mês" ativo={aberto === "atual"} onClick={() => setAberto("atual")} />
        <BlocoSobra r={rSeguinte} rotulo="Mês que vem" ativo={aberto === "seguinte"} onClick={() => setAberto("seguinte")} />
      </div>

      <Conta r={detalhe} />
      <AvisoFixas />
      <Limites rAtual={rAtual} rSeguinte={rSeguinte} hoje={dia} />
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

/** A conta do mês escolhido: entra, sai, sobra. Cada linha abre o detalhe. */
function Conta({ r }: { r: ResumoMes }) {
  const semFatura = r.itensFatura.some((f) => f.informado === null);
  return (
    <div className="cartao mb-3 p-0 text-sm">
      <div className="px-3 pt-2 text-xs font-medium text-tinta/50">Conta de {nomeMes(r.mes)}</div>

      <Abre rotulo="Entra" valor={r.recebido + r.aReceber} cor="text-verde">
        <Sub rotulo="Já entrou" valor={r.recebido} />
        {r.rendas.filter((x) => x.falta > 0).map((x) => (
          <Sub key={x.fonte.id} rotulo={`Falta: ${x.fonte.nome}`} valor={x.falta} />
        ))}
      </Abre>

      <Abre rotulo="Pix, débito e dinheiro" valor={-r.gastoAVista} />

      <Abre rotulo="Faturas" valor={-r.faturas}>
        {r.itensFatura.map((f) => (
          <Sub
            key={f.cartao.id}
            rotulo={`${f.cartao.nome} · dia ${f.cartao.dia_vencimento}${f.informado === null ? " · só o lançado aqui" : ""}${f.fixas.length ? ` · com ${f.fixas.length} ${f.fixas.length > 1 ? "contas fixas" : "conta fixa"}` : ""}`}
            valor={-f.valor}
          />
        ))}
        {semFatura && (
          <p className="px-3 pb-2 pl-6 text-xs text-tinta/50">
            Digite a fatura do app do banco em <Link href="/cadastros" className="underline">Ajustes</Link> para o número começar certo.
          </p>
        )}
      </Abre>

      {r.itensCompromisso.length > 0 && (
        <div className="border-t border-tinta/5 px-3 py-1.5">
          <div className="flex items-center justify-between">
            <span>Parcelas e contas fixas</span>
            <span className="tabular-nums">{reais(-r.parcelas)}</span>
          </div>
          {r.itensCompromisso.map((c) => <ParcelaMensal key={c.compromisso.id} item={c} mes={r.mes} />)}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-tinta/10 px-3 py-2 font-semibold">
        <span>Sobra</span>
        <span className={`tabular-nums ${r.sobra < 0 ? "text-vermelho" : "text-verde"}`}>{reais(r.sobra)}</span>
      </div>
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

function Abre({ rotulo, valor, cor, children }: { rotulo: string; valor: number; cor?: string; children?: React.ReactNode }) {
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
    <details className="group border-t border-tinta/5">
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
        <span>Limite livre dos cartões</span>
        <Link href="/cadastros" className="underline">atualizar</Link>
      </div>
      <div className={`mb-3 grid gap-2 ${cartoes.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {cartoes.map((l) => (
          <div key={l.cartao.id} className="cartao px-2.5 py-2">
            <div className="truncate text-xs text-tinta/60">{l.cartao.nome.replace(" Visa Gold", "")}</div>
            <div className={`text-sm font-semibold tabular-nums ${l.livre < 0 ? "text-vermelho" : ""}`}>{curto(l.livre)}</div>
            <Barra usado={l.usado} total={l.limite} />
            <div className="mt-0.5 text-[10px] text-tinta/50">usando {curto(l.usado)}</div>
          </div>
        ))}
      </div>

      {contas.filter((c) => c.conta.limite_cheque_especial).map((c) => <ChequeEspecial key={c.conta.id} c={c} />)}

      {comSaldo.length > 0 && (
        <div className="cartao px-3 py-2">
          <div className="mb-1 text-xs font-medium text-tinta/50">Contas somadas, com a sobra prevista</div>
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

/** Fica vermelho quando a conta está no cheque especial. */
function ChequeEspecial({ c }: { c: SituacaoConta }) {
  const limite = Number(c.conta.limite_cheque_especial);
  if (c.saldo === null) {
    return (
      <div className="cartao mb-3 px-3 py-2 text-xs text-tinta/60">
        Cheque especial · {c.conta.nome}: informe o saldo em <Link href="/cadastros" className="underline">Ajustes</Link>.
      </div>
    );
  }
  const emUso = c.chequeEmUso > 0;
  const p = limite ? Math.min(100, (c.chequeEmUso / limite) * 100) : 0;
  return (
    <div className={`mb-3 rounded-2xl px-3 py-2 shadow-sm ring-1 ${emUso ? "bg-vermelho text-white ring-vermelho" : "bg-white ring-tinta/5"}`}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{emUso ? "Usando cheque especial" : "Cheque especial"} · {c.conta.nome}</span>
        <span className="font-semibold tabular-nums">{emUso ? curto(-c.chequeEmUso) : "sem uso"}</span>
      </div>
      <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${emUso ? "bg-white/30" : "bg-tinta/10"}`}>
        <div className="h-full rounded-full bg-white" style={{ width: `${p}%` }} />
      </div>
      <div className={`mt-0.5 text-[10px] ${emUso ? "text-white/85" : "text-tinta/50"}`}>
        livre {curto(c.chequeLivre ?? 0)} de {curto(limite)}
        {c.desde ? ` · saldo do app em ${dataCurta(c.desde)}` : ""}
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
