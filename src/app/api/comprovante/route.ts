// Recebe a foto ou o PDF de um comprovante, pede para a IA ler e devolve o lançamento preenchido.
// Dois jeitos de chamar:
//  - pelo app (botão "Enviar comprovante"): JSON com o arquivo em base64 e o login do Supabase;
//  - pelo Atalho do iPhone: o arquivo puro, com ?chave=ATALHO_CHAVE. Devolve um link para abrir o app.

import { createClient } from "@supabase/supabase-js";
import { heicParaJpeg } from "@/lib/heic";
import { lerComprovante, paraEndereco, tipoDoArquivo, type Contexto } from "@/lib/comprovante";

export const runtime = "nodejs";
export const maxDuration = 60;

const limpar = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

function erro(mensagem: string, status = 400) {
  return Response.json({ erro: mensagem }, { status });
}

function hojeEmCuiaba(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date());
}

async function ehMembro(token: string): Promise<boolean> {
  const url = limpar(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const anon = limpar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anon) return false;
  const s = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data } = await s.from("membros").select("user_id").limit(1);
  return !!data?.length; // as regras do banco só mostram membros para quem é membro
}

function iguais(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function POST(req: Request) {
  const chaveApi = limpar(process.env.ANTHROPIC_API_KEY);

  const endereco = new URL(req.url);
  const chaveAtalho = endereco.searchParams.get("chave") ?? req.headers.get("x-chave-atalho") ?? "";
  const doAtalho = !!chaveAtalho;
  // O Atalho só sabe abrir um link; então, mesmo com erro, devolve um link que mostra o aviso no app.
  const falha = (mensagem: string, status = 400) =>
    doAtalho ? Response.json({ link: `${endereco.origin}/lancar?aviso=${encodeURIComponent(mensagem)}`, erro: mensagem }) : erro(mensagem, status);
  if (!chaveApi) return falha("Falta configurar a ANTHROPIC_API_KEY na Vercel.", 500);
  const ctx: Contexto = { hoje: hojeEmCuiaba() };
  let bytes: Uint8Array;

  if (doAtalho) {
    if (!iguais(chaveAtalho, limpar(process.env.ATALHO_CHAVE))) return falha("Chave do Atalho errada.", 401);
    const tipoCorpo = req.headers.get("content-type") ?? "";
    if (tipoCorpo.includes("multipart/form-data")) {
      const form = await req.formData();
      const arquivo = [...form.values()].find((v): v is File => typeof v !== "string");
      if (!arquivo) return falha("Não veio arquivo.");
      bytes = new Uint8Array(await arquivo.arrayBuffer());
    } else {
      bytes = new Uint8Array(await req.arrayBuffer());
    }
  } else {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token || !(await ehMembro(token))) return falha("Entre no app de novo e tente outra vez.", 401);
    const corpo = await req.json().catch(() => null);
    if (!corpo?.arquivo) return falha("Não veio arquivo.");
    bytes = Uint8Array.from(Buffer.from(String(corpo.arquivo), "base64"));
    ctx.pessoas = Array.isArray(corpo.pessoas) ? corpo.pessoas.slice(0, 4).map(String) : undefined;
    ctx.contas = Array.isArray(corpo.contas) ? corpo.contas.slice(0, 20).map(String) : undefined;
    ctx.categorias = Array.isArray(corpo.categorias) ? corpo.categorias.slice(0, 150).map(String) : undefined;
  }

  if (!bytes.length) return falha("O arquivo veio vazio.");
  let tipo = tipoDoArquivo(bytes);
  if (tipo === "image/heic") {
    try {
      bytes = await heicParaJpeg(bytes);
      tipo = "image/jpeg";
    } catch {
      return falha("Não consegui abrir essa foto (HEIC). Tire um print do comprovante e envie o print.");
    }
  }
  if (!tipo || !TIPOS_ACEITOS.includes(tipo)) return falha("Envie uma foto (JPG ou PNG) ou um PDF.");

  try {
    const leitura = await lerComprovante(chaveApi, Buffer.from(bytes).toString("base64"), tipo, ctx);
    if (leitura.valor <= 0) return falha("Não achei um valor nesse arquivo. Ele é um comprovante?", 422);
    if (doAtalho) return Response.json({ link: `${endereco.origin}${paraEndereco(leitura)}`, leitura });
    return Response.json({ leitura });
  } catch (e) {
    return falha(e instanceof Error ? e.message : String(e), 502);
  }
}
