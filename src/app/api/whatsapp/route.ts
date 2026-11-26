// Endereço que recebe os recados do WhatsApp (WhatsApp Cloud API, da Meta).
//  - GET: a Meta confere o endereço uma vez, quando a gente cola ele no painel dela.
//  - POST: chega um recado. Responde "ok" na hora e faz o trabalho logo depois:
//    texto ("mercado 85 cartão MP") ou foto/PDF de comprovante viram lançamento;
//    "desfaz" apaga o último lançamento que veio do WhatsApp.
//    Se parecer repetido (mesmo valor e descrição parecida há poucos dias), pergunta
//    "Lançar mesmo assim?" com botões Sim/Não e guarda o lançamento em whatsapp_pendentes.
// Só aceita os números de WHATSAPP_PESSOAS (Diego e Jô). Os demais são ignorados.

import { after } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { heicParaJpeg } from "@/lib/heic";
import { lerComprovante, lerTexto, tipoDoArquivo, type Contexto, type Leitura } from "@/lib/comprovante";
import { reais } from "@/lib/formato";
import { acharRepetido, DIAS_REPETIDO, textoRepetido } from "@/lib/repetido";
import type { Cartao, Categoria, Conta, GrupoCategoria, Lancamento, RegraCategoria } from "@/lib/tipos";
import {
  AJUDA,
  assinaturaValida,
  ehAjuda,
  ehDesfazer,
  ehNao,
  ehSim,
  lerPessoas,
  montarLancamento,
  quemEnviou,
  recadosDoPacote,
  textoConfirmacao,
  type Recado,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

const GRAPH = "https://graph.facebook.com/v21.0";
const limpar = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
const env = (nome: string) => limpar(process.env[nome]);
const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

function hojeEmCuiaba(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date());
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const certo = env("WHATSAPP_VERIFICACAO");
  if (p.get("hub.mode") === "subscribe" && certo && p.get("hub.verify_token") === certo) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Código de verificação errado.", { status: 403 });
}

export async function POST(req: Request) {
  const corpo = await req.text();
  if (!assinaturaValida(corpo, req.headers.get("x-hub-signature-256"), env("WHATSAPP_APP_SECRET"))) {
    return new Response("Assinatura inválida.", { status: 401 });
  }
  let pacote: unknown;
  try {
    pacote = JSON.parse(corpo);
  } catch {
    return new Response("ok");
  }
  const recados = recadosDoPacote(pacote);
  // A Meta quer resposta rápida; o trabalho (IA, banco) roda logo depois.
  if (recados.length) after(() => Promise.all(recados.map(tratarComCuidado)));
  return new Response("ok");
}

async function tratarComCuidado(r: Recado) {
  try {
    await tratar(r);
  } catch (e) {
    await responder(r.de, `⚠️ Não consegui lançar: ${e instanceof Error ? e.message : String(e)}`).catch(() => {});
  }
}

function banco(): SupabaseClient {
  const url = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const chave = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chave) throw new Error("Falta configurar a SUPABASE_SERVICE_ROLE_KEY na Vercel.");
  return createClient(url, chave, { auth: { persistSession: false } });
}

async function tratar(r: Recado) {
  const quem = quemEnviou(r.de, lerPessoas(process.env.WHATSAPP_PESSOAS));
  if (!quem) return; // número desconhecido: nem responde
  const s = banco();

  // A Meta às vezes manda o mesmo recado duas vezes.
  const repetido = await s.from("lancamentos").select("id").eq("whatsapp_id", r.id).limit(1);
  if (repetido.error) throw new Error("Falta rodar a atualização 0010_whatsapp.sql no Supabase.");
  if (repetido.data.length) return;

  const membro = await s.from("membros").select("user_id").eq("apelido", quem).limit(1);
  const criadoPor: string | null = membro.data?.[0]?.user_id ?? null;

  // Resposta à pergunta "Lançar mesmo assim?"
  if (r.tipo === "botao") return responderPendente(s, r.de, r.resposta);
  if (r.tipo === "texto" && (ehSim(r.texto) || ehNao(r.texto))) {
    if (await responderPendente(s, r.de, ehSim(r.texto) ? "sim" : "nao", true)) return;
  }

  if (r.tipo === "outro") return responder(r.de, "Por enquanto eu entendo texto, foto e PDF.\n\n" + AJUDA);
  if (r.tipo === "texto" && ehAjuda(r.texto)) return responder(r.de, AJUDA);
  if (r.tipo === "texto" && ehDesfazer(r.texto)) return desfazer(s, r.de, criadoPor);

  const chaveIA = env("ANTHROPIC_API_KEY");
  if (!chaveIA) throw new Error("Falta configurar a ANTHROPIC_API_KEY na Vercel.");
  const cad = await carregarCadastros(s);
  const hoje = hojeEmCuiaba();
  const ctx: Contexto = {
    hoje,
    pessoas: ["Diego", "Jô"],
    contas: [...cad.contas.map((c) => `conta ${c.nome}`), ...cad.cartoes.map((c) => `cartão ${c.nome}`)],
    categorias: cad.categoriasDaCasa.map((c) => c.nome),
  };

  let leitura: Leitura;
  if (r.tipo === "texto") {
    leitura = await lerTexto(chaveIA, r.texto, ctx);
    if (leitura.valor <= 0) {
      return responder(r.de, "Não achei um valor nesse recado. Perguntas sobre o mês chegam na próxima etapa.\n\n" + AJUDA);
    }
  } else {
    const { bytes, tipo } = await baixarMidia(r.midiaId);
    leitura = await lerComprovante(chaveIA, Buffer.from(bytes).toString("base64"), tipo, ctx);
    if (leitura.valor <= 0) return responder(r.de, "Não achei um valor nesse arquivo. Ele é um comprovante?");
  }

  const registro = montarLancamento(leitura, quem, cad, { hoje, whatsappId: r.id, criadoPor });

  // Parece já lançado? Pergunta antes (a compra pode ter sido feita duas vezes, então dá para lançar).
  const pergunta = await perguntaDeRepetido(s, registro, criadoPor);
  if (pergunta) {
    const guardado = await s.from("whatsapp_pendentes").upsert({ telefone: r.de, registro, criado_em: new Date().toISOString() });
    if (!guardado.error) return perguntar(r.de, `⚠️ ${pergunta}`);
    // sem a atualização 0013 ainda: lança e só avisa
    return lancar(s, r.de, registro, cad, hoje, `⚠️ ${pergunta.replace(" Lançar mesmo assim?", "")} Se for repetido, responda *desfaz*.`);
  }
  await lancar(s, r.de, registro, cad, hoje);
}

type Cadastros = Awaited<ReturnType<typeof carregarCadastros>>;

async function lancar(s: SupabaseClient, para: string, registro: Partial<Lancamento>, cad: Cadastros, hoje: string, nota = "") {
  const { error } = await s.from("lancamentos").insert(registro);
  if (error) {
    if (error.code === "23505") return; // já lançado (recado repetido)
    throw new Error(error.message);
  }
  await responder(para, [nota, textoConfirmacao(registro, cad, hoje)].filter(Boolean).join("\n\n"));
}

/** Procura um lançamento parecido feito nos últimos dias e monta a pergunta (ou null). */
async function perguntaDeRepetido(s: SupabaseClient, registro: Partial<Lancamento>, criadoPor: string | null) {
  if (!registro.tipo || !registro.valor || !registro.data) return null;
  const desde = new Date(Date.now() - DIAS_REPETIDO * 86400000).toISOString();
  const { data, error } = await s
    .from("lancamentos")
    .select("id, tipo, valor, data, descricao, criado_por, criado_em")
    .eq("valor", registro.valor)
    .gte("criado_em", desde);
  if (error || !data?.length) return null;
  const novo = { tipo: registro.tipo, valor: registro.valor, data: registro.data, descricao: registro.descricao ?? null };
  const achado = acharRepetido(novo, data as Lancamento[]);
  if (!achado) return null;
  let quem: string | null = null;
  if (achado.criado_por && achado.criado_por === criadoPor) quem = "Você";
  else if (achado.criado_por) {
    const m = await s.from("membros").select("nome").eq("user_id", achado.criado_por).limit(1);
    quem = m.data?.[0]?.nome ?? null;
  }
  return textoRepetido(achado, quem);
}

/**
 * Sim/Não para o lançamento que ficou esperando. Devolve false quando não havia nada esperando
 * (aí um "sim" digitado segue como recado normal, se `seguir` for true).
 */
async function responderPendente(s: SupabaseClient, para: string, resposta: "sim" | "nao", seguir = false): Promise<boolean> {
  const { data } = await s.from("whatsapp_pendentes").select("registro, criado_em").eq("telefone", para).limit(1);
  const pendente = data?.[0];
  const valido = pendente && Date.now() - Date.parse(pendente.criado_em) < 24 * 3600 * 1000;
  if (!valido) {
    if (seguir) return false;
    await responder(para, "Não tinha nada esperando resposta. Se quiser lançar, mande o gasto de novo.");
    return true;
  }
  await s.from("whatsapp_pendentes").delete().eq("telefone", para);
  const registro = pendente.registro as Partial<Lancamento>;
  if (resposta === "nao") {
    await responder(para, `👍 Ok, não lancei ${reais(Number(registro.valor))}${registro.descricao ? ` · ${registro.descricao}` : ""}.`);
    return true;
  }
  await lancar(s, para, registro, await carregarCadastros(s), hojeEmCuiaba());
  return true;
}

async function desfazer(s: SupabaseClient, para: string, criadoPor: string | null) {
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  let q = s.from("lancamentos").select("id, valor, descricao").not("whatsapp_id", "is", null).gte("criado_em", desde);
  if (criadoPor) q = q.eq("criado_por", criadoPor);
  const { data } = await q.order("criado_em", { ascending: false }).limit(1);
  const ultimo = data?.[0];
  if (!ultimo) return responder(para, "Não achei nada lançado por você pelo WhatsApp nas últimas 24 horas.");
  const { error } = await s.from("lancamentos").delete().eq("id", ultimo.id);
  if (error) throw new Error(error.message);
  await responder(para, `🗑️ Apaguei: ${reais(Number(ultimo.valor))}${ultimo.descricao ? ` · ${ultimo.descricao}` : ""}`);
}

async function carregarCadastros(s: SupabaseClient) {
  const desde = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [contas, cartoes, categorias, grupos, regras, lancamentos] = await Promise.all([
    s.from("contas").select("*").order("nome"),
    s.from("cartoes").select("*").order("nome"),
    s.from("categorias").select("*").order("ordem").order("nome"),
    s.from("grupos").select("*"),
    s.from("regras_categoria").select("*"),
    s.from("lancamentos").select("tipo, descricao, categoria_id, negocio_id").eq("tipo", "saida").gte("data", desde).limit(3000),
  ]);
  const gruposLista = (grupos.data ?? []) as GrupoCategoria[];
  const categoriasDaCasa = ((categorias.data ?? []) as Categoria[]).filter(
    (c) => !gruposLista.find((g) => g.id === c.grupo_id)?.negocio_id,
  );
  return {
    contas: (contas.data ?? []) as Conta[],
    cartoes: (cartoes.data ?? []) as Cartao[],
    categoriasDaCasa,
    regras: (regras.data ?? []) as RegraCategoria[],
    lancamentos: (lancamentos.data ?? []) as Lancamento[],
  };
}

async function baixarMidia(midiaId: string): Promise<{ bytes: Uint8Array; tipo: string }> {
  const token = env("WHATSAPP_TOKEN");
  const info = await fetch(`${GRAPH}/${midiaId}`, { headers: { Authorization: `Bearer ${token}` } }).then((x) => x.json());
  if (!info?.url) throw new Error("Não consegui baixar o arquivo do WhatsApp.");
  const arquivo = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!arquivo.ok) throw new Error("Não consegui baixar o arquivo do WhatsApp.");
  let bytes: Uint8Array = new Uint8Array(await arquivo.arrayBuffer());
  let tipo = tipoDoArquivo(bytes);
  if (tipo === "image/heic") {
    bytes = await heicParaJpeg(bytes);
    tipo = "image/jpeg";
  }
  if (!tipo || !TIPOS_ACEITOS.includes(tipo)) throw new Error("Envie uma foto (JPG ou PNG) ou um PDF.");
  return { bytes, tipo };
}

/** Pergunta com dois botões: Sim (lança) e Não (descarta). */
async function perguntar(para: string, texto: string) {
  const r = await fetch(`${GRAPH}/${env("WHATSAPP_NUMERO_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: texto.slice(0, 1000) },
        action: {
          buttons: [
            { type: "reply", reply: { id: "sim", title: "Sim, lançar" } },
            { type: "reply", reply: { id: "nao", title: "Não" } },
          ],
        },
      },
    }),
  });
  // se os botões falharem, manda em texto (a pessoa responde "sim" ou "não")
  if (!r.ok) await responder(para, `${texto}\nResponda *sim* ou *não*.`);
}

async function responder(para: string, texto: string) {
  const r = await fetch(`${GRAPH}/${env("WHATSAPP_NUMERO_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto.slice(0, 4000) } }),
  });
  if (!r.ok) console.error("WhatsApp não enviou a resposta:", r.status, await r.text().catch(() => ""));
}
