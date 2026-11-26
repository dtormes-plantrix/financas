import { describe, expect, it } from "vitest";
import { conciliar } from "../src/lib/extrato/conciliar";
import { decodificarOfx, lerOfx } from "../src/lib/extrato/ofx";
import type { Cartao, Conta, Lancamento } from "../src/lib/tipos";

// OFX 1.x (SGML, sem fechar as tags), como o Sicredi e o Banco do Brasil exportam
const SICREDI_OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261126<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>0748<ACCTID>12345<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261101<DTEND>20261125
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261102120000[-3:BRT]<TRNAMT>-48.00<FITID>A1<MEMO>PAGAMENTO PIX 06564773188 Padaria Boa
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105<TRNAMT>10638.00<FITID>A2<MEMO>TRANSF ENTRE CONTAS 24793736068 SADY ELIAS SOLET
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261114<TRNAMT>-3799.79<FITID>A3<MEMO>DEB.CTA.FATURA
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261115<TRNAMT>2000.00<FITID>A4<MEMO>RECEBIMENTO PIX 85523968153 DIEGO TORMES
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261116<TRNAMT>-48.00<FITID>A5<MEMO>PAGAMENTO PIX 06564773188 Padaria Boa
</BANKTRANLIST>
<LEDGERBAL><BALAMT>7742.21<DTASOF>20261125</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

// OFX 2.x (XML), fatura do cartão como o Nubank exporta
const NUBANK_OFX = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="211" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
<SIGNONMSGSRSV1><SONRS><FI><ORG>NU PAGAMENTOS S.A.</ORG><FID>260</FID></FI></SONRS></SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>BRL</CURDEF>
<BANKTRANLIST><DTSTART>20260920000000[-3:BRT]</DTSTART><DTEND>20261020000000[-3:BRT]</DTEND>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260920000000[-3:BRT]</DTPOSTED><TRNAMT>-144.66</TRNAMT><FITID>n1</FITID><MEMO>Lojas Renner - Parcela 3/3</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260922000000[-3:BRT]</DTPOSTED><TRNAMT>-14.95</TRNAMT><FITID>n2</FITID><MEMO>Uber - NuPay</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261017000000[-3:BRT]</DTPOSTED><TRNAMT>-293.29</TRNAMT><FITID>n3</FITID><MEMO>Café &amp; Pão</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260928000000[-3:BRT]</DTPOSTED><TRNAMT>1000.00</TRNAMT><FITID>n4</FITID><MEMO>Pagamento recebido</MEMO></STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>-452.90</BALAMT><DTASOF>20261020</DTASOF></LEDGERBAL>
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

const contas: Conta[] = [
  { id: "mp", nome: "Mercado Pago", dono: "diego", limite_cheque_especial: null, saldo: null, saldo_atualizado_em: null, ativo: true },
  { id: "sic", nome: "Sicredi", dono: "jo", limite_cheque_especial: 20000, saldo: null, saldo_atualizado_em: null, ativo: true },
];
const cartoes: Cartao[] = [
  { id: "nu", nome: "Nubank", dono: "jo", limite: null, dia_fechamento: 20, dia_vencimento: 27, conta_pagamento_id: null, limite_usado: null, limite_atualizado_em: null, ativo: true },
];
const fontes = [{ id: "sady", nome: "Ajuda do Sady", valor_bruto: null, percentual_imposto: 0, dia_previsto: 5, conta_id: "sic", ativo: true }];

function lanc(p: Partial<Lancamento>): Lancamento {
  return {
    id: crypto.randomUUID(), tipo: "saida", valor: 0, data: "2026-10-01", descricao: null, forma: "pix", conta_id: null,
    cartao_id: null, parcelas: 1, fonte_id: null, categoria_id: null, de_quem: "jo", criado_por: null, criado_em: "", ...p,
  };
}

describe("leitor de OFX", () => {
  it("lê o extrato OFX antigo (SGML) do Sicredi", () => {
    const a = lerOfx(SICREDI_OFX)!;
    expect(a).toMatchObject({ banco: "sicredi", tipo: "extrato", formato: "ofx", semTotal: true });
    expect(a.titulo).toBe("Extrato Sicredi (OFX) de 01/11/2026 a 25/11/2026");
    expect(a.itens).toHaveLength(5);
    expect(a.itens[0]).toMatchObject({ data: "2026-11-02", descricao: "Padaria Boa", valor: 48, sinal: "sai" });
    expect(a.itens[0].idBanco).toBe("sicredi:A1:2026-11-02:-48");
  });

  it("lê a fatura OFX (XML) do Nubank, confere o total e acha a data da compra parcelada", () => {
    const a = lerOfx(NUBANK_OFX)!;
    expect(a).toMatchObject({ banco: "nubank", tipo: "fatura", confere: true, semTotal: false, totalDoBanco: 452.9 });
    const renner = a.itens.find((i) => i.descricao === "Lojas Renner")!;
    expect(renner.parcela).toEqual({ numero: 3, de: 3 });
    expect(renner.data).toBe("2026-07-20");
    expect(a.itens.some((i) => i.descricao === "Café & Pão")).toBe(true);
  });

  it("abre arquivo em Windows-1252 sem estragar o acento", () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("CHARSET:1252\n<OFX><MEMO>Farm"), 0xe1, ...new TextEncoder().encode("cia")]);
    expect(decodificarOfx(bytes)).toContain("Farmácia");
  });

  it("não confunde PDF com OFX", () => {
    expect(lerOfx("EXTRATO DE CONTA\nSaldo inicial")).toBeNull();
  });
});

describe("conciliar OFX", () => {
  it("fatura: pagamento fica fora e a compra já lançada é reconhecida", () => {
    const ls = conciliar(lerOfx(NUBANK_OFX)!, { tipo: "cartao", id: "nu" }, {
      contas, cartoes, fontes,
      lancamentos: [lanc({ valor: 14.95, data: "2026-09-22", forma: "credito", cartao_id: "nu" })],
    });
    expect(ls.find((l) => l.item.descricao === "Uber - NuPay")!.situacao).toBe("lancado");
    expect(ls.find((l) => /Pagamento/.test(l.item.original))!.situacao).toBe("fora");
    expect(ls.find((l) => l.item.descricao === "Lojas Renner")!.novo).toMatchObject({ valor: 433.98, parcelas: 3, id_banco: "nubank:n1:2026-09-20:-144.66" });
  });

  it("extrato: pagamento de fatura fica fora e Pix do Diego vira Entre contas", () => {
    const ls = conciliar(lerOfx(SICREDI_OFX)!, { tipo: "conta", id: "sic" }, { contas, cartoes, fontes, lancamentos: [] });
    expect(ls.map((l) => l.situacao)).toEqual(["falta", "falta", "fora", "falta", "falta"]);
    expect(ls[3].novo).toMatchObject({ tipo: "transferencia", conta_id: "mp", conta_destino_id: "sic" });
  });

  it("duas compras iguais no mesmo valor: importar de novo não duplica nem esconde nenhuma", () => {
    const a = lerOfx(SICREDI_OFX)!;
    const base = { contas, cartoes, fontes, lancamentos: [] as Lancamento[] };
    const primeira = conciliar(a, { tipo: "conta", id: "sic" }, base);
    expect(primeira.filter((l) => l.item.descricao === "Padaria Boa").map((l) => l.situacao)).toEqual(["falta", "falta"]);
    // lança só a segunda padaria; a primeira continua faltando
    const so = primeira.filter((l) => l.marcado && l.item.idBanco?.includes(":A5:")).map((l) => lanc(l.novo!));
    const de_novo = conciliar(a, { tipo: "conta", id: "sic" }, { ...base, lancamentos: so });
    expect(de_novo.filter((l) => l.item.descricao === "Padaria Boa").map((l) => l.situacao)).toEqual(["falta", "lancado"]);
    // tudo lançado: nada falta
    const todos = primeira.filter((l) => l.marcado).map((l) => lanc(l.novo!));
    const terceira = conciliar(a, { tipo: "conta", id: "sic" }, { ...base, lancamentos: todos });
    expect(terceira.filter((l) => l.situacao === "falta")).toHaveLength(0);
  });
});
