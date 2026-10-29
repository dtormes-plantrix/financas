# FINANÇAS

Sistema de finanças da casa de Diego e Jô: ver em tempo real como está o mês atual e o seguinte, com base no extrato do banco, nos lançamentos do dia a dia e nas faturas dos cartões (com dia de fechamento).

- [Plano do sistema](docs/PLANO.md)
- [Mapa de squads e agentes](docs/mapa-de-squads.md)
- [Guia de instalação (Supabase + Vercel)](docs/GUIA-INSTALACAO.md)

## O que já funciona (Fase 1)

- Login para Diego e Jô (ninguém mais entra).
- Painel com a sobra deste mês e do mês que vem.
- Lançar entrada ou saída em 3 toques (valor, forma de pagamento, salvar), com cartão e parcelas.
- Regra da fatura: o app diz em qual fatura a compra cai, respeitando o dia de fechamento.
- Lista do mês com filtro por pessoa e forma de pagamento; tocar num item edita ou apaga.
- Ajustes: cartões, valor da fatura do app do banco, rendas (com imposto) e contas.

## Para quem for mexer no código

```bash
npm install
npm run dev    # abre em http://localhost:3000 (modo demonstração sem .env.local)
npm test       # testes da regra da fatura e do painel
npm run build  # gera o site em out/
```

Tecnologia: Next.js (site estático que funciona como app), Supabase (dados e login), Tailwind (visual).
