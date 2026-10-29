"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { modoDemo, supabase } from "@/lib/dados";

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (modoDemo) router.replace("/");
  }, [router]);

  async function aoEntrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) setErro("E-mail ou senha não conferem.");
    else router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-bold">Finanças da casa</h1>
      <p className="mb-8 text-tinta/60">Diego e Jô</p>
      <form onSubmit={aoEntrar} className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p className="text-sm text-vermelho">{erro}</p>}
        <button className="botao-principal" disabled={entrando}>{entrando ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
