"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { carregarTudo, modoDemo, supabase, type Dados } from "@/lib/dados";
import type { Membro } from "@/lib/tipos";

type Contexto = {
  dados: Dados;
  eu: Membro;
  recarregar: () => Promise<void>;
  trocarPessoaDemo: () => void;
};

const Ctx = createContext<Contexto | null>(null);

export function useSessao(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSessao fora da Sessao");
  return c;
}

const CHAVE_PESSOA_DEMO = "financas-demo-pessoa";

export function Sessao({ children }: { children: ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();
  const naTelaDeEntrar = caminho?.startsWith("/entrar");
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Quem está usando
  useEffect(() => {
    if (modoDemo) {
      let id = "demo-diego";
      try {
        id = localStorage.getItem(CHAVE_PESSOA_DEMO) || id;
      } catch {}
      setUserId(id);
      return;
    }
    const s = supabase();
    s.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = s.auth.onAuthStateChange((_e, sessao) => setUserId(sessao?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const recarregar = useCallback(async () => {
    try {
      setDados(await carregarTudo());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (userId === null && !naTelaDeEntrar) router.replace("/entrar");
    if (userId) recarregar();
  }, [userId, naTelaDeEntrar, router, recarregar]);

  const trocarPessoaDemo = useCallback(() => {
    const novo = userId === "demo-diego" ? "demo-jo" : "demo-diego";
    try {
      localStorage.setItem(CHAVE_PESSOA_DEMO, novo);
    } catch {}
    setUserId(novo);
  }, [userId]);

  if (naTelaDeEntrar) return <>{children}</>;

  if (erro) {
    return (
      <Aviso titulo="Não consegui carregar os dados">
        <p className="mb-4 text-sm text-tinta/70">{erro}</p>
        <button className="botao-principal" onClick={recarregar}>Tentar de novo</button>
      </Aviso>
    );
  }

  if (!userId || !dados) return <Aviso titulo="Carregando…" />;

  const eu = dados.membros.find((m) => m.user_id === userId);
  if (!eu) {
    return (
      <Aviso titulo="Seu acesso ainda não foi liberado">
        <p className="mb-4 text-sm text-tinta/70">
          Este e-mail entrou, mas ainda não está na lista de pessoas da casa. Veja o passo 5 do guia de instalação.
        </p>
        <button className="botao-secundario" onClick={() => supabase().auth.signOut()}>Sair</button>
      </Aviso>
    );
  }

  return <Ctx.Provider value={{ dados, eu, recarregar, trocarPessoaDemo }}>{children}</Ctx.Provider>;
}

function Aviso({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="mb-3 text-xl font-semibold">{titulo}</h1>
      {children}
    </main>
  );
}
