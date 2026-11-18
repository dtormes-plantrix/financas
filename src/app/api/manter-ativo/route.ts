// Mantém o Supabase acordado.
// O plano grátis pausa o banco depois de 7 dias sem uso. A Vercel chama este
// endereço uma vez por dia (veja vercel.json), e ele faz uma consulta bem leve.
// Se CRON_SECRET existir na Vercel, só a própria Vercel consegue chamar.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limpar = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

export async function GET(req: Request) {
  const segredo = limpar(process.env.CRON_SECRET);
  if (segredo && req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const url = limpar(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const chave = limpar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !chave) return Response.json({ ok: false, erro: "faltam chaves do Supabase" }, { status: 500 });

  const s = createClient(url, chave, { auth: { persistSession: false } });
  const { error } = await s.from("categorias").select("id").limit(1);
  if (error) return Response.json({ ok: false, erro: error.message }, { status: 502 });
  return Response.json({ ok: true, quando: new Date().toISOString() });
}
