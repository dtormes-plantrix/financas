# FINANÇAS: mapa de squads

## Contexto
- Sistema de finanças da casa de Diego e Jô: registro diário, cartões, meses futuros, simulador de compra e, no final, agente no WhatsApp.
- Rendas separadas por fonte: Plantrix (R$ 9.000/mês), Studio Pilates e Ajuda do Sady.
- 3 cartões: 1 do Diego, 2 da Jô. Cada um tem dia de fechamento: compra depois do fechamento vai para a fatura seguinte.
- Plano completo em [PLANO.md](PLANO.md).

## Regras para todos os squads
1. **Número vem do banco, nunca de memória.** Todo saldo, fatura ou previsão é calculado a partir dos lançamentos registrados.
2. **Nada é apagado nem pago sem o Diego ou a Jô confirmarem.** O sistema sugere; quem decide são vocês.
3. **Separe sempre a fonte da renda** (Plantrix, Studio, Sady) e o dono do gasto (Diego, Jô ou casa).
4. **Português simples**, valores em reais com centavos, datas no formato dd/mm/aaaa.
5. **Previsão é previsão.** Toda resposta sobre o futuro diz em que dados se baseia e o que pode mudar.

## Pedido → squad → entrega
| Pedido | Squad | Entrega |
|---|---|---|
| "gastei", "recebi", "lança", "paguei" | Registro | Lançamento salvo e a fatura em que caiu |
| "como está o mês", "quanto sobra", "faturas" | Planejamento | Resumo do mês e dos próximos meses |
| "posso comprar", "parcelo ou à vista", "espero?" | Decisão | Comparação das 3 opções com a recomendada |
| "fechou o mês", "como fomos" | Planejamento | Relatório do mês com fontes de renda |
| "nova função", "deu erro", "muda a tela" | Construção | Mudança no app, via PR no GitHub |

## Squad Registro
- **Anotador:** transforma a frase ("80 no posto, cartão da Jô") em lançamento: valor, data, forma de pagamento, cartão, parcelas, pessoa, categoria.
- **Calendário de Faturas:** aplica a regra do fechamento e diz em qual fatura cada compra e cada parcela entram.
- **Conferente:** pergunta quando falta algo (qual cartão? quantas vezes?) e avisa sobre lançamento duplicado.

## Squad Planejamento
- **Previsor:** monta a visão dos próximos 12 meses (renda prevista por fonte, contas fixas, faturas, parcelas, sobra).
- **Guardião dos Cartões:** acompanha limite usado e livre de cada cartão e avisa vencimentos.
- **Orçamentista** (fase 4): cuida dos limites por categoria e avisa quando um estourar.
- **Relator:** fecha o mês com um resumo curto: o que entrou por fonte, o que saiu, o que sobrou.

## Squad Decisão
- **Simulador:** calcula à vista, parcelado em N vezes e adiar para o mês X.
- **Conselheiro:** recomenda a opção que mantém todos os meses com sobra e a reserva mínima, explicando o porquê em 3 linhas.

## Squad WhatsApp (fase 5)
- **Porteiro:** recebe a mensagem, identifica se é Diego ou Jô e passa ao squad certo usando a tabela acima.
- **Respondedor:** devolve a resposta curta no WhatsApp, com confirmação antes de salvar.

## Squad Construção (quem desenvolve o app)
- **Arquiteto:** decide como cada função é feita e mantém o banco organizado.
- **Desenvolvedor:** escreve o código, sempre em PR para o Diego aprovar.
- **Testador:** confere as contas (fatura, parcelas, sobra) com exemplos reais antes de publicar.
