// Relatório e avisos de orçamento pelo WhatsApp, para Diego e Jô (WHATSAPP_PESSOAS).
// A Vercel chama este endereço todo dia às 8h de Cuiabá (veja vercel.json):
//  - segunda: resumo da semana; dia 1: fechamento do mês anterior;
//  - todo dia: aviso se uma categoria passou de 90% ou estourou o orçamento.
// Se a pessoa escreveu para o número nas últimas 24h, vai o texto completo.
// Senão, vai o modelo aprovado pela Meta com o botão "Ver relatório"; ao tocar,
// a rota /api/whatsapp responde com o texto completo.
// Se CRON_SECRET existir na Vercel, só a própria Vercel consegue chamar.

import { createClient } from "@supabase/supabase-js";
import { carregarTudo } from "@/lib/dados";
import {
  avisosDeOrcamento, camposDoAviso, camposDoModelo, relatorioDoDia, textoAviso, textoRelatorio,
} from "@/lib/relatorio";
import { enviarModelo, enviarTexto, janelaAberta } from "@/lib/whatsapp-envio";
import { lerPessoas } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limpar = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
const env = (nome: string) => limpar(process.env[nome]);

function hojeEmCuiaba(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba" }).format(new Date());
}

export async function GET(req: Request) {
  const segredo = env("CRON_SECRET");
  if (segredo && req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const url = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const chave = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chave) return Response.json({ ok: false, erro: "faltam chaves do Supabase" }, { status: 500 });
  const s = createClient(url, chave, { auth: { persistSession: false } });

  const hoje = hojeEmCuiaba();
  const enviados = await s.from("avisos_enviados").select("chave").gte("enviado_em", new Date(Date.now() - 40 * 86400000).toISOString());
  if (enviados.error) return Response.json({ ok: false, erro: "Falta rodar a atualização 0014_relatorio_whatsapp.sql no Supabase." }, { status: 500 });
  const jaAvisados = new Set((enviados.data ?? []).map((x) => x.chave as string));

  const dados = await carregarTudo(s);
  const tipo = relatorioDoDia(hoje);
  const chaveRelatorio = `relatorio:${hoje}`;
  const relatorio = tipo && !jaAvisados.has(chaveRelatorio) ? tipo : null;
  const avisos = avisosDeOrcamento(dados, hoje, jaAvisados);
  // estourou e ainda não tinha avisado os 90%: manda só o de 100%
  const avisosParaMandar = avisos.filter((a) => a.nivel === 100 || !avisos.some((b) => b.item.categoria.id === a.item.categoria.id && b.nivel === 100));
  if (!relatorio && !avisos.length) return Response.json({ ok: true, hoje, enviado: "nada" });

  const contatos = await s.from("whatsapp_contatos").select("quem, telefone, ultima_mensagem");
  const pessoas = lerPessoas(process.env.WHATSAPP_PESSOAS);
  const log: string[] = [];
  let algumOk = false;

  for (const [numero, quem] of pessoas) {
    const contato = (contatos.data ?? []).find((c) => c.quem === quem);
    const para = contato?.telefone ?? numero;
    const aberta = janelaAberta(contato?.ultima_mensagem);

    if (relatorio) {
      const r = aberta
        ? await enviarTexto(para, textoRelatorio(relatorio, dados, hoje))
        : await enviarModelo(para, "relatorio_financas", camposDoModelo(relatorio, dados, hoje), `relatorio:${relatorio}`);
      algumOk ||= r.ok;
      log.push(`${quem}: ${relatorio} ${aberta ? "texto" : "modelo"} ${r.ok ? "ok" : r.erro}`);
    }
    for (const a of avisosParaMandar) {
      const r = aberta
        ? await enviarTexto(para, textoAviso(a))
        : await enviarModelo(para, "aviso_orcamento", camposDoAviso(a));
      algumOk ||= r.ok;
      log.push(`${quem}: aviso ${a.item.categoria.nome} ${a.nivel}% ${r.ok ? "ok" : r.erro}`);
    }
  }

  // Marca como enviado só se chegou para alguém (assim tenta de novo amanhã se a Meta recusou).
  if (algumOk) {
    const chaves = [...(relatorio ? [chaveRelatorio] : []), ...avisos.map((a) => a.chave)];
    await s.from("avisos_enviados").upsert(chaves.map((chave) => ({ chave })));
  }
  return Response.json({ ok: true, hoje, log });
}
