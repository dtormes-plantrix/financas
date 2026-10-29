# FINANÇAS: mapa de squads

## Contexto
- Sistema de finanças da casa de Diego e Jô: ver em tempo real como está o mês atual e o seguinte, com base no extrato do banco, nos lançamentos do dia a dia e nas faturas dos cartões.
- Rendas separadas por fonte: Plantrix (R$ 9.000/mês), Studio Pilates e Ajuda do Sady.
- 3 cartões: 1 do Diego, 2 da Jô. Compra depois do dia de fechamento vai para a fatura seguinte.
- Prioridade: experiência de uso simples e intuitiva, no celular.
- Plano completo em [PLANO.md](PLANO.md).

## Regras para todos os squads
1. **Número vem do banco de dados, nunca de memória.** Todo saldo, fatura ou previsão é calculado a partir dos lançamentos e extratos.
2. **Nada é apagado sem o Diego ou a Jô confirmarem.**
3. **Separe sempre a fonte da renda** (Plantrix, Studio, Sady) e o dono do gasto (Diego, Jô ou casa).
4. **Português simples na tela**, valores em reais com centavos, datas no formato dd/mm/aaaa.
5. **Toda tela passa pelo teste da Jô e do Diego** antes de ser considerada pronta.

## Pedido → squad → entrega
| Pedido | Squad | Entrega |
|---|---|---|
| "lança", "gastei", "recebi", "subi o extrato" | Registro | Lançamentos salvos, sem duplicar, na fatura certa |
| "como está o mês", "quanto sobra", "faturas" | Painel | Sobra do mês atual e do seguinte, com o que compõe |
| "fechou o mês", "como fomos" | Painel | Resumo do mês por fonte de renda |
| "está difícil de usar", "muda a tela" | Experiência | Proposta de tela, testada com vocês |
| "nova função", "deu erro" | Construção | Mudança no app, via PR no GitHub |

## Squad Registro
- **Anotador:** transforma o lançamento em dado completo: valor, data, forma de pagamento, cartão, parcelas, pessoa, categoria.
- **Importador:** lê o extrato (OFX ou CSV) e a fatura, e reconhece o que já estava lançado para não duplicar.
- **Calendário de Faturas:** aplica a regra do fechamento e diz em qual fatura cada compra e parcela entram.

## Squad Painel
- **Previsor:** calcula a sobra do mês atual e do seguinte (renda prevista por fonte, contas fixas, faturas, parcelas).
- **Guardião dos Cartões:** acompanha limite usado e livre e avisa vencimentos.
- **Relator:** fecha o mês com um resumo curto.
- **Orçamentista** (fase 4): limites por categoria e alerta de estouro.

## Squad Experiência
- **Designer de Telas:** desenha cada tela pensando no celular, em uma mão e em até 3 toques.
- **Revisor de Linguagem:** troca termo técnico por palavra do dia a dia.
- **Testador com Usuário:** roteiro curto para Diego e Jô testarem cada tela, e anota o que travou.

## Squad Construção
- **Arquiteto:** decide como cada função é feita e mantém o banco de dados organizado.
- **Desenvolvedor:** escreve o código, sempre em PR para o Diego aprovar.
- **Conferente de Contas:** testa fatura, parcelas e sobra com exemplos reais antes de publicar.
