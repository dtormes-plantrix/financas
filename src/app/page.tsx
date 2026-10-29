"use client";

import Link from "next/link";
import { useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { nomeMes, somarMeses, type Mes } from "@/lib/fatura";
import { reais } from "@/lib/formato";
import { resumoDoMes, type ResumoMes } from "@/lib/painel";

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
  const atual = mesAtual();
  const seguinte = somarMeses(atual, 1);
  const rAtual = resumoDoMes(atual, dados);
  const rSeguinte = resumoDoMes(seguinte, dados);
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
