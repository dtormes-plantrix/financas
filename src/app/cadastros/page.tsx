"use client";

import { useState } from "react";
import { Pagina } from "@/components/Navegacao";
import { useSessao } from "@/components/Sessao";
import { excluir, informarFatura, modoDemo, resetarDemo, salvar, supabase } from "@/lib/dados";
import { chaveMes, nomeMes, somarMeses, type Mes } from "@/lib/fatura";
import { dataCurta, hoje, lerValor, NOME_DONO, reais } from "@/lib/formato";
import { liquido } from "@/lib/painel";
import type { Cartao, Compromisso, Conta, FonteRenda } from "@/lib/tipos";

function mesAtual(): Mes {
  const d = new Date();
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

const numeroOuNulo = (t: string) => (t.trim() === "" ? null : lerValor(t));
const paraTexto = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

export default function Ajustes() {
  const { dados, eu, recarregar, trocarPessoaDemo } = useSessao();
  const atual = mesAtual();
  const meses = [atual, somarMeses(atual, 1)];

  return (
    <Pagina titulo="Ajustes">
      {modoDemo && (
        <div className="mb-6 rounded-2xl bg-amarelo-claro p-4 text-sm">
          <p className="mb-3">
            <strong>Modo demonstração.</strong> Os dados ficam só neste aparelho. Você está usando como{" "}
            <strong>{eu.nome}</strong>.
          </p>
          <div className="flex gap-2">
            <button className="botao-secundario text-sm" onClick={trocarPessoaDemo}>Usar como {eu.apelido === "diego" ? "Jô" : "Diego"}</button>
            <button className="botao-secundario text-sm" onClick={async () => { resetarDemo(); await recarregar(); }}>Recomeçar exemplo</button>
          </div>
        </div>
      )}

      {dados.bancoDesatualizado && (
        <div className="mb-6 rounded-2xl bg-vermelho-claro p-4 text-sm">
          <strong>Falta atualizar o banco de dados.</strong> No Supabase, abra o SQL Editor, cole o arquivo{" "}
          <code>supabase/migrations/0002_limites_e_parcelas.sql</code> e clique em Run. Sem isso, limites e parcelas não salvam.
        </div>
      )}

      <Secao titulo="Cartões" ajuda="Compra depois do dia de fechamento vai para a fatura seguinte.">
        {dados.cartoes.map((c) => <EditorCartao key={c.id} cartao={c} meses={meses} />)}
      </Secao>

      <Secao titulo="Rendas" ajuda="Valor bruto por mês. O imposto é descontado para prever o que chega na conta.">
        {dados.fontes.map((f) => <EditorFonte key={f.id} fonte={f} />)}
      </Secao>

      <Secao titulo="Contas" ajuda="Copie o saldo do app do banco de vez em quando. Negativo quer dizer cheque especial em uso.">
        {dados.contas.map((c) => <EditorConta key={c.id} conta={c} />)}
      </Secao>

      <Secao titulo="Parcelas mensais" ajuda="Empréstimos, dívidas e contas fixas fora do cartão. Entram no painel até serem pagas.">
        {dados.compromissos.map((c) => <EditorCompromisso key={c.id} compromisso={c} />)}
        <NovoCompromisso />
      </Secao>

      {!modoDemo && (
        <button className="botao-secundario w-full" onClick={() => supabase().auth.signOut()}>
          Sair ({eu.nome})
        </button>
      )}
    </Pagina>
  );
}

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {ajuda && <p className="mb-3 text-sm text-tinta/60">{ajuda}</p>}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function useSalvar() {
  const { recarregar } = useSessao();
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | string>("");
  async function rodar(fn: () => Promise<void>) {
    setEstado("salvando");
    try {
      await fn();
      await recarregar();
      setEstado("salvo");
      setTimeout(() => setEstado(""), 2000);
    } catch (e) {
      setEstado(`Erro: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { estado, rodar };
}

function BotaoSalvar({ estado, onClick }: { estado: string; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button className="botao-secundario py-2 text-sm" onClick={onClick} disabled={estado === "salvando"}>Salvar</button>
      <span className="text-sm text-tinta/60">{estado === "salvo" ? "Salvo ✓" : estado === "salvando" ? "Salvando…" : estado}</span>
    </div>
  );
}

function Campo({ rotulo, valor, onChange, sufixo, largura = "w-full" }: { rotulo: string; valor: string; onChange: (v: string) => void; sufixo?: string; largura?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-tinta/60">{rotulo}</span>
      <span className="flex items-center gap-2">
        <input inputMode="decimal" className={`campo py-2 ${largura}`} value={valor} onChange={(e) => onChange(e.target.value)} />
        {sufixo && <span className="text-sm text-tinta/60">{sufixo}</span>}
      </span>
    </label>
  );
}

function EditorCartao({ cartao, meses }: { cartao: Cartao; meses: Mes[] }) {
  const { dados } = useSessao();
  const { estado, rodar } = useSalvar();
  const [limite, setLimite] = useState(paraTexto(cartao.limite));
  const [fecha, setFecha] = useState(String(cartao.dia_fechamento));
  const [vence, setVence] = useState(String(cartao.dia_vencimento));
  const [usado, setUsado] = useState(paraTexto(cartao.limite_usado));
  const [faturas, setFaturas] = useState(() =>
    meses.map((m) => paraTexto(dados.faturasInformadas.find((f) => f.cartao_id === cartao.id && f.mes === chaveMes(m))?.valor)),
  );

  return (
    <div className="cartao space-y-3">
      <div className="font-medium">
        {cartao.nome} <span className="text-sm text-tinta/50">· {NOME_DONO[cartao.dono]}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo="Limite" valor={limite} onChange={setLimite} />
        <Campo rotulo="Fecha dia" valor={fecha} onChange={setFecha} />
        <Campo rotulo="Vence dia" valor={vence} onChange={setVence} />
      </div>
      <Campo
        rotulo={`Limite usado agora, do app do banco${cartao.limite_atualizado_em ? ` (atualizado em ${dataCurta(cartao.limite_atualizado_em)})` : ""}`}
        valor={usado}
        onChange={setUsado}
      />
      <div className="rounded-xl bg-papel p-3">
        <p className="mb-2 text-xs text-tinta/60">Valor da fatura no app do banco (deixe vazio para usar só o que foi lançado aqui)</p>
        <div className="grid grid-cols-2 gap-3">
          {meses.map((m, i) => (
            <Campo
              key={chaveMes(m)}
              rotulo={`Fatura de ${nomeMes(m)}`}
              valor={faturas[i]}
              onChange={(v) => setFaturas(faturas.map((x, j) => (j === i ? v : x)))}
            />
          ))}
        </div>
      </div>
      <BotaoSalvar
        estado={estado}
        onClick={() =>
          rodar(async () => {
            await salvar("cartoes", {
              id: cartao.id,
              limite: numeroOuNulo(limite),
              dia_fechamento: Math.min(31, Math.max(1, Number(fecha) || cartao.dia_fechamento)),
              dia_vencimento: Math.min(31, Math.max(1, Number(vence) || cartao.dia_vencimento)),
              ...(paraTexto(cartao.limite_usado) !== usado
                ? { limite_usado: numeroOuNulo(usado), limite_atualizado_em: usado.trim() ? hoje() : null }
                : {}),
            });
            for (const [i, m] of meses.entries()) await informarFatura(cartao.id, chaveMes(m), numeroOuNulo(faturas[i]));
          })
        }
      />
    </div>
  );
}

function EditorFonte({ fonte }: { fonte: FonteRenda }) {
  const { estado, rodar } = useSalvar();
  const [bruto, setBruto] = useState(paraTexto(fonte.valor_bruto));
  const [imposto, setImposto] = useState(paraTexto(fonte.percentual_imposto));
  const [dia, setDia] = useState(paraTexto(fonte.dia_previsto));
  const previa = liquido({ ...fonte, valor_bruto: numeroOuNulo(bruto), percentual_imposto: lerValor(imposto) });

  return (
    <div className="cartao space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{fonte.nome}</span>
        {previa > 0 && <span className="text-sm text-tinta/60">chega {reais(previa)}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Campo rotulo="Valor bruto" valor={bruto} onChange={setBruto} />
        <Campo rotulo="Imposto %" valor={imposto} onChange={setImposto} />
        <Campo rotulo="Dia" valor={dia} onChange={setDia} />
      </div>
      <BotaoSalvar
        estado={estado}
        onClick={() =>
          rodar(() =>
            salvar("fontes_renda", {
              id: fonte.id,
              valor_bruto: numeroOuNulo(bruto),
              percentual_imposto: lerValor(imposto),
              dia_previsto: dia ? Math.min(31, Math.max(1, Number(dia))) : null,
            }),
          )
        }
      />
    </div>
  );
}

function EditorConta({ conta }: { conta: Conta }) {
  const { estado, rodar } = useSalvar();
  const [cheque, setCheque] = useState(paraTexto(conta.limite_cheque_especial));
  const [saldo, setSaldo] = useState(paraTexto(conta.saldo));
  return (
    <div className="cartao space-y-3">
      <div className="font-medium">
        {conta.nome} <span className="text-sm text-tinta/50">· {NOME_DONO[conta.dono]}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo={`Saldo agora${conta.saldo_atualizado_em ? ` (em ${dataCurta(conta.saldo_atualizado_em)})` : ""}`}
          valor={saldo}
          onChange={setSaldo}
        />
        <Campo rotulo="Limite do cheque especial" valor={cheque} onChange={setCheque} />
      </div>
      <BotaoSalvar
        estado={estado}
        onClick={() =>
          rodar(() =>
            salvar("contas", {
              id: conta.id,
              limite_cheque_especial: numeroOuNulo(cheque),
              ...(paraTexto(conta.saldo) !== saldo
                ? { saldo: numeroOuNulo(saldo), saldo_atualizado_em: saldo.trim() ? hoje() : null }
                : {}),
            }),
          )
        }
      />
    </div>
  );
}

function mesTexto(chave: string) {
  const [a, m] = chave.split("-");
  return `${m}/${a}`;
}

function lerMesTexto(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2})\/(\d{4})$/);
  return m ? `${m[2]}-${m[1].padStart(2, "0")}` : null;
}

function EditorCompromisso({ compromisso: c }: { compromisso: Compromisso }) {
  const { recarregar } = useSessao();
  const { estado, rodar } = useSalvar();
  const [valor, setValor] = useState(paraTexto(c.valor));
  const [total, setTotal] = useState(paraTexto(c.valor_total ?? c.total_parcelas));
  const [inicio, setInicio] = useState(mesTexto(c.mes_inicial));
  const [parcelaInicial, setParcelaInicial] = useState(String(c.parcela_inicial));
  const [dia, setDia] = useState(paraTexto(c.dia_vencimento));
  const divida = c.valor_total !== null;

  return (
    <div className="cartao space-y-3">
      <div className="font-medium">{c.nome}</div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor por mês" valor={valor} onChange={setValor} />
        <Campo rotulo={divida ? "Total a devolver" : "Total de parcelas"} valor={total} onChange={setTotal} />
        <Campo rotulo={divida ? "Começa em (mês/ano)" : `Parcela ${parcelaInicial} vence em (mês/ano)`} valor={inicio} onChange={setInicio} />
        {divida ? (
          <Campo rotulo="Dia de pagar" valor={dia} onChange={setDia} />
        ) : (
          <Campo rotulo="Número dessa parcela" valor={parcelaInicial} onChange={setParcelaInicial} />
        )}
      </div>
      <div className="flex items-center justify-between">
        <BotaoSalvar
          estado={estado}
          onClick={() =>
            rodar(async () => {
              const mes = lerMesTexto(inicio);
              if (!mes) throw new Error("use o formato mês/ano, ex.: 11/2026");
              await salvar("compromissos", {
                id: c.id,
                valor: lerValor(valor),
                mes_inicial: mes,
                dia_vencimento: dia ? Math.min(31, Math.max(1, Number(dia))) : null,
                ...(divida
                  ? { valor_total: numeroOuNulo(total) }
                  : { total_parcelas: total ? Number(total) : null, parcela_inicial: Math.max(1, Number(parcelaInicial) || 1) }),
              });
            })
          }
        />
        <button
          className="text-sm text-vermelho"
          onClick={async () => {
            if (!confirm(`Apagar "${c.nome}"? Os pagamentos já lançados continuam na lista.`)) return;
            await excluir("compromissos", c.id);
            await recarregar();
          }}
        >
          Apagar
        </button>
      </div>
    </div>
  );
}

function NovoCompromisso() {
  const { estado, rodar } = useSalvar();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"parcelas" | "divida" | "fixa">("parcelas");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [total, setTotal] = useState("");
  const [atual, setAtual] = useState("1");
  const d = new Date();
  const [inicio, setInicio] = useState(`${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);

  if (!aberto) {
    return <button className="botao-secundario w-full" onClick={() => setAberto(true)}>+ Nova parcela mensal</button>;
  }

  return (
    <div className="cartao space-y-3">
      <div className="flex flex-wrap gap-2">
        {([["parcelas", "Parcelado"], ["divida", "Dívida"], ["fixa", "Conta fixa"]] as const).map(([t, r]) => (
          <button key={t} onClick={() => setTipo(t)} className={`chip py-2 text-sm ${tipo === t ? "chip-ativo" : ""}`}>{r}</button>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-tinta/60">Nome</span>
        <input className="campo py-2" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Empréstimo, Internet" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor por mês" valor={valor} onChange={setValor} />
        {tipo === "parcelas" && <Campo rotulo="Total de parcelas" valor={total} onChange={setTotal} />}
        {tipo === "divida" && <Campo rotulo="Total a devolver" valor={total} onChange={setTotal} />}
        <Campo rotulo="Mês (mês/ano)" valor={inicio} onChange={setInicio} />
        {tipo === "parcelas" && <Campo rotulo="Parcela desse mês" valor={atual} onChange={setAtual} />}
      </div>
      <BotaoSalvar
        estado={estado}
        onClick={() =>
          rodar(async () => {
            const mes = lerMesTexto(inicio);
            if (!nome.trim() || lerValor(valor) <= 0 || !mes) throw new Error("preencha nome, valor e mês/ano");
            await salvar("compromissos", {
              nome: nome.trim(),
              valor: lerValor(valor),
              mes_inicial: mes,
              parcela_inicial: tipo === "parcelas" ? Math.max(1, Number(atual) || 1) : 1,
              total_parcelas: tipo === "parcelas" && total ? Number(total) : null,
              valor_total: tipo === "divida" ? numeroOuNulo(total) : null,
              dia_vencimento: null,
              conta_id: null,
              ativo: true,
            });
            setAberto(false);
            setNome("");
            setValor("");
            setTotal("");
          })
        }
      />
    </div>
  );
}
