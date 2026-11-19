-- Atualização 0011: descontos reais da Plantrix (Diego, 19/11/2026, conferidos no extrato do Asaas de novembro).
-- Faturamento R$ 9.000 = Famato R$ 7.000 + Logorama R$ 2.000.
-- Por nota: imposto da nota R$ 399,30 + ISS R$ 126 retido pela Famato = R$ 525,30 (5,84% de 9.000).
-- Fixos: INSS R$ 277,20 + Contabilivre R$ 165,87 = R$ 443,07.
-- Líquido previsto: cerca de R$ 8.031,33 por mês.
-- Pode rodar mais de uma vez sem problema.
update fontes_renda set valor_bruto = 9000, percentual_imposto = 5.84, descontos_fixos = 443.07
where nome = 'Plantrix';
