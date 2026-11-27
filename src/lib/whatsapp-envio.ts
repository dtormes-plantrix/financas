// Envio de mensagens pelo WhatsApp Cloud API (só no servidor).
//
// Regra da Meta: o app só pode mandar texto livre até 24h depois da última
// mensagem da pessoa. Fora dessa janela, só um "modelo de mensagem" aprovado
// pela Meta (template). Por isso o relatório guarda quando cada pessoa escreveu
// por último (tabela whatsapp_contatos) e escolhe entre texto e modelo.

export const GRAPH = "https://graph.facebook.com/v21.0";
const limpar = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
const env = (nome: string) => limpar(process.env[nome]);

/** Margem de 1h para não mandar texto no limite da janela de 24h. */
export const JANELA_MS = 23 * 3600 * 1000;

export function janelaAberta(ultimaMensagem: string | null | undefined, agora = Date.now()): boolean {
  return !!ultimaMensagem && agora - Date.parse(ultimaMensagem) < JANELA_MS;
}

async function enviar(corpo: Record<string, unknown>): Promise<{ ok: boolean; erro?: string }> {
  const r = await fetch(`${GRAPH}/${env("WHATSAPP_NUMERO_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...corpo }),
  });
  if (r.ok) return { ok: true };
  const erro = `${r.status} ${await r.text().catch(() => "")}`.slice(0, 500);
  console.error("WhatsApp não enviou:", erro);
  return { ok: false, erro };
}

export function enviarTexto(para: string, texto: string) {
  return enviar({ to: para, type: "text", text: { body: texto.slice(0, 4000) } });
}

/** Modelo aprovado pela Meta. `botao` é o código devolvido quando a pessoa toca no botão de resposta rápida. */
export function enviarModelo(para: string, nome: string, campos: string[], botao?: string) {
  const components: Record<string, unknown>[] = [
    // a Meta não aceita quebra de linha nem tab dentro dos campos
    { type: "body", parameters: campos.map((t) => ({ type: "text", text: t.replace(/\s+/g, " ").trim() })) },
  ];
  if (botao) components.push({ type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: botao }] });
  return enviar({ to: para, type: "template", template: { name: nome, language: { code: "pt_BR" }, components } });
}
