"use client";

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
} from "@/lib/painel";

function mesAtual(): Mes {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

function tom(sobra: number, base: number) {
  if (sobra < 0) return { fundo: "bg-vermelho-claro", texto: "text-vermelho", frase: "Vai faltar" };
  if (sobra < base * 0.1) return { fundo: "bg-amarelo-claro", texto: "text-amarelo", frase: "Apertado" };
  return { fundo: "bg-verde-claro", texto: "text-verde", frase: "Vai sobrar" };
}

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
      <p className="mb-1 text-tinta/60">Olá, {eu.nome}</p>
      <h1 className="mb-5 text-2xl font-semibold">Como estamos</h1>

      <div className="mb-6 grid grid-cols-1 gap-3">
        <BlocoSobra r={rAtual} rotulo="Este mês" ativo={aberto === "atual"} onClick={() => setAberto("atual")} />
        <BlocoSobra r={rSeguinte} rotulo="Mês que vem" ativo={aberto === "seguinte"} onClick={() => setAberto("seguinte")} />
      </div>

      <h2 className="mb-3 text-lg font-semibold">De onde vem o número de {nomeMes(detalhe.mes)}</h2>
      <div className="cartao divide-y divide-tinta/5 p-0">
        <Linha rotulo="Já entrou" valor={detalhe.recebido} />
        <Linha rotulo="Ainda vai entrar" valor={detalhe.aReceber} />
        {detalhe.rendas.filter((r) => r.falta > 0).map((r) => (
          <Linha key={r.fonte.id} rotulo={r.fonte.nome} valor={r.falta} recuo />
        ))}
        <Linha rotulo="Gastos no pix, débito e dinheiro" valor={-detalhe.gastoAVista} />
        <Linha rotulo="Faturas dos cartões" valor={-detalhe.faturas} />
        {detalhe.itensFatura.map((f) => (
          <Linha
            key={f.cartao.id}
            rotulo={`${f.cartao.nome} · vence dia ${f.cartao.dia_vencimento}`}
            valor={-f.valor}
            recuo
            nota={f.informado === null ? "só o que foi lançado aqui" : "valor do app do banco"}
          />
        ))}
        {detalhe.itensCompromisso.length > 0 && (
          <>
            <Linha rotulo="Parcelas a pagar" valor={-detalhe.parcelas} />
            {detalhe.itensCompromisso.map((c) => (
              <ParcelaMensal key={c.compromisso.id} item={c} mes={detalhe.mes} />
            ))}
          </>
        )}
        <div className="flex items-center justify-between px-4 py-4 font-semibold">
          <span>Sobra</span>
          <span className={detalhe.sobra < 0 ? "text-vermelho" : "text-verde"}>{reais(detalhe.sobra)}</span>
        </div>
      </div>

      {detalhe.itensFatura.some((f) => f.informado === null) && (
        <p className="mt-4 text-sm text-tinta/60">
          Dica: enquanto as compras antigas não estão no sistema, digite o valor da fatura que aparece no app do banco em{" "}
          <Link href="/cadastros" className="underline">Ajustes</Link>. Assim o número já começa certo.
        </p>
      )}

      <Limites rAtual={rAtual} rSeguinte={rSeguinte} hoje={dia} />
    </Pagina>
  );
}

function BlocoSobra({ r, rotulo, ativo, onClick }: { r: ResumoMes; rotulo: string; ativo: boolean; onClick: () => void }) {
  const t = tom(r.sobra, r.recebido + r.aReceber);
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl p-5 text-left transition ${t.fundo} ${ativo ? "ring-2 ring-tinta/80" : "ring-1 ring-tinta/5"}`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{rotulo}</span>
        <span className="text-sm capitalize text-tinta/60">{nomeMes(r.mes)}</span>
      </div>
      <div className={`mt-2 text-4xl font-bold tracking-tight ${t.texto}`}>{reais(r.sobra)}</div>
      <div className="mt-1 text-sm text-tinta/70">{t.frase}</div>
    </button>
  );
}

function Linha({ rotulo, valor, recuo, nota }: { rotulo: string; valor: number; recuo?: boolean; nota?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${recuo ? "pl-8 text-sm text-tinta/70" : ""}`}>
      <span>
        {rotulo}
        {nota && <span className="block text-xs text-tinta/50">{nota}</span>}
      </span>
      <span className="shrink-0 tabular-nums">{reais(valor)}</span>
    </div>
  );
}

/** Uma parcela mensal, com o botão "Paguei" e o valor pago editável. */
function ParcelaMensal({ item, mes }: { item: ItemCompromisso; mes: Mes }) {
  const { dados, eu, recarregar } = useSessao();
  const [pagando, setPagando] = useState(false);
  const [valorTexto, setValorTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const minhaConta = dados.contas.find((c) => c.dono === eu.apelido) ?? dados.contas[0];
  const [contaId, setContaId] = useState(minhaConta?.id);
  const pagamentos = dados.lancamentos.filter((l) => l.compromisso_id === item.compromisso.id && noMes(l.data, mes));

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
        descricao: item.compromisso.nome,
        forma: "pix",
        conta_id: contaId ?? null,
        cartao_id: null,
        parcelas: 1,
        fonte_id: null,
        categoria_id: null,
        de_quem: "casa",
        compromisso_id: item.compromisso.id,
      });
      await recarregar();
      setPagando(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="px-4 py-3 pl-8 text-sm">
      <div className="flex items-center justify-between gap-3 text-tinta/70">
        <span>
          {item.compromisso.nome}
          <span className="block text-xs text-tinta/50">{item.rotulo}</span>
        </span>
        <span className="shrink-0 tabular-nums">{reais(-item.falta)}</span>
      </div>

      {pagamentos.map((p) => (
        <Link key={p.id} href={`/lancar?id=${p.id}`} className="mt-2 flex items-center justify-between rounded-lg bg-verde-claro px-3 py-2 text-verde">
          <span>Pago {reais(p.valor)} em {dataCurta(p.data)}</span>
          <span className="underline">editar</span>
        </Link>
      ))}

      {!pagando && item.falta > 0 && noMes(hoje(), mes) && (
        <button onClick={abrir} className="mt-2 rounded-lg bg-tinta px-3 py-2 font-medium text-white">Paguei</button>
      )}

      {pagando && (
        <div className="mt-2 space-y-2 rounded-xl bg-papel p-3">
          <label className="block text-xs text-tinta/60" htmlFor={`pago-${item.compromisso.id}`}>Quanto pagou</label>
          <div className="flex items-center rounded-xl bg-white px-3 ring-1 ring-tinta/15">
            <span className="text-tinta/40">R$</span>
            <input
              id={`pago-${item.compromisso.id}`}
              inputMode="decimal"
              autoFocus
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
              className="w-full bg-transparent px-2 py-2.5 text-lg font-semibold outline-none"
            />
          </div>
          {dados.contas.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {dados.contas.filter((c) => c.ativo).map((c) => (
                <button key={c.id} onClick={() => setContaId(c.id)} className={`chip py-1.5 text-sm ${contaId === c.id ? "chip-ativo" : ""}`}>
                  {c.nome}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={confirmar} disabled={salvando} className="rounded-lg bg-tinta px-4 py-2 font-medium text-white">
              {salvando ? "Salvando…" : "Confirmar"}
            </button>
            <button onClick={() => setPagando(false)} className="px-3 py-2 text-tinta/60">Cancelar</button>
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
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tinta/10" role="meter" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
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
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">Limites</h2>
      <div className="space-y-3">
        {cartoes.map((l) => (
          <div key={l.cartao.id} className="cartao">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{l.cartao.nome}</span>
              <span className="text-sm text-tinta/60">livre {reais(l.livre)}</span>
            </div>
            <Barra usado={l.usado} total={l.limite} />
            <div className="mt-1 text-xs text-tinta/50">
              usando {reais(l.usado)} de {reais(l.limite)}
              {l.cartao.limite_usado === null || l.cartao.limite_usado === undefined
                ? " · só o que foi lançado aqui"
                : l.desde ? ` · do app em ${dataCurta(l.desde)} + compras lançadas depois` : ""}
            </div>
          </div>
        ))}

        {contas.filter((c) => c.conta.limite_cheque_especial).map((c) => (
          <div key={c.conta.id} className="cartao">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">Cheque especial · {c.conta.nome}</span>
              {c.saldo !== null && <span className="text-sm text-tinta/60">livre {reais(c.chequeLivre ?? 0)}</span>}
            </div>
            {c.saldo === null ? (
              <p className="mt-1 text-sm text-tinta/60">
                Informe o saldo da conta em <Link href="/cadastros" className="underline">Ajustes</Link> para ver quanto está em uso.
              </p>
            ) : (
              <>
                <Barra usado={c.chequeEmUso} total={Number(c.conta.limite_cheque_especial)} />
                <div className="mt-1 text-xs text-tinta/50">
                  {c.chequeEmUso > 0 ? `usando ${reais(c.chequeEmUso)} de ${reais(Number(c.conta.limite_cheque_especial))}` : "sem uso agora"}
                  {c.desde ? ` · saldo do app em ${dataCurta(c.desde)}` : ""}
                </div>
              </>
            )}
          </div>
        ))}

        {comSaldo.length > 0 && (
          <div className="cartao">
            <div className="mb-2 font-medium">Contas somadas, com a sobra prevista</div>
            <Projecao rotulo="Hoje" valor={saldoHoje} limite={limiteCheque} />
            <Projecao rotulo={`Fim de ${nomeMes(rAtual.mes)}`} valor={fimMes} limite={limiteCheque} />
            <Projecao rotulo={`Fim de ${nomeMes(rSeguinte.mes)}`} valor={fimSeguinte} limite={limiteCheque} />
            <p className="mt-2 text-xs text-tinta/50">
              Negativo quer dizer cheque especial em uso. A previsão conta as rendas que faltam entrar, as faturas e as parcelas que ainda vão vencer.
              {comSaldo.length < contas.length && " Falta informar o saldo de alguma conta em Ajustes."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Projecao({ rotulo, valor, limite }: { rotulo: string; valor: number; limite: number }) {
  const emUso = Math.max(0, -valor);
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{rotulo}</span>
      <span className="text-right">
        <span className={`block font-semibold tabular-nums ${valor < 0 ? "text-vermelho" : "text-verde"}`}>{reais(valor)}</span>
        {emUso > 0 && limite > 0 && (
          <span className="block text-xs text-tinta/50">
            {emUso > limite ? `passa ${reais(emUso - limite)} do cheque especial` : `${Math.round((emUso / limite) * 100)}% do cheque especial`}
          </span>
        )}
      </span>
    </div>
  );
}
