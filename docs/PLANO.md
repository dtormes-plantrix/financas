# Plano do sistema FINANÇAS

Versão 1 · 29/10/2026 · Diego e Jô

## 1. O que o sistema resolve

Um lugar só, fácil de usar no celular, onde Diego e Jô registram tudo o que entra e sai, e que responde três perguntas:

1. **Como estamos este mês?** Quanto entrou, quanto saiu, quanto sobra.
2. **Como estão os próximos meses?** Quanto já está comprometido (faturas, parcelas, contas fixas) e quanto fica livre.
3. **Posso comprar isso?** À vista, parcelado ou depois: qual opção cabe melhor.

## 2. Os dois conceitos, em linguagem simples

| | Fluxo de caixa | Orçamento |
|---|---|---|
| O que é | O que **já aconteceu** | O que **está planejado** |
| Exemplo | "Paguei R$ 230 no mercado, no pix" | "Todo dia 5 entra a Plantrix, todo dia 10 vence a luz" |
| Responde | Para onde foi o dinheiro | Quanto vai sobrar em cada mês futuro |

O sistema junta os dois: **saldo de hoje + o que vai entrar − o que já está comprometido = o que está livre em cada mês.** É essa conta que alimenta o simulador de compras.

## 3. Cadastros básicos

### Pessoas
- Diego
- Jô

Todo lançamento guarda **quem registrou** e **de quem é** (Diego, Jô ou casa).

### Fontes de renda (separadas)
| Fonte | Valor mensal | Observação |
|---|---|---|
| Plantrix | R$ 9.000 | Valor fixo informado |
| Studio Pilates | a definir | Jô já tem um controle básico; trazer esse histórico |
| Ajuda do Sady | a definir | |

Cada entrada é marcada com a sua fonte, para ver quanto cada uma contribui e o que acontece se uma delas faltar.

### Formas de pagamento
- Dinheiro
- Pix
- Débito
- Cartão de crédito (escolhendo **qual** cartão)

### Cartões de crédito
| Cartão | Dono | Limite | Dia de fechamento | Dia de vencimento |
|---|---|---|---|---|
| Cartão 1 | Diego | a preencher | a preencher | a preencher |
| Cartão 2 | Jô | a preencher | a preencher | a preencher |
| Cartão 3 | Jô | a preencher | a preencher | a preencher |

**Regra da fatura:** compra feita **até** o dia de fechamento entra na fatura que vence neste mês. Compra feita **depois** do fechamento entra na fatura **seguinte**. O sistema calcula isso sozinho na hora do registro e mostra, por exemplo: "Esta compra vai para a fatura de dezembro".

Compra parcelada gera uma parcela em cada fatura futura, já seguindo essa regra.

### Categorias
No começo, o controle é **geral** (só o saldo do mês). Mesmo assim, cada lançamento já pode receber uma categoria opcional (mercado, casa, saúde, lazer...), para que depois seja fácil ligar o **orçamento por categoria** sem perder o histórico.

## 4. Funcionalidades

### Registro (dia a dia)
- Lançar entrada ou saída em poucos toques: valor, descrição, forma de pagamento, cartão (se for crédito), parcelas, categoria (opcional).
- Contas fixas e recorrentes (aluguel, luz, internet, assinaturas) cadastradas uma vez e repetidas todo mês.
- Lista do mês com filtro por pessoa, forma de pagamento e fonte de renda.

### Cartões
- Fatura atual e próximas faturas de cada cartão.
- Limite usado e limite livre, contando as parcelas futuras.
- Aviso quando a fatura estiver perto do vencimento.

### Visão dos próximos meses
- Tabela dos próximos 6 a 12 meses: renda prevista, contas fixas, faturas e parcelas, **sobra prevista**.
- Separação por fonte de renda (Plantrix, Studio, Sady).

### Simulador de compra
Informe o valor e veja, lado a lado:
- **À vista** (pix ou débito, com desconto se houver): quanto sobra este mês.
- **Parcelado** em N vezes: quanto cada mês futuro fica apertado e em qual fatura começa.
- **Adiar** para o mês X: quando a sobra permite comprar sem aperto.

O sistema indica a opção que mantém todos os meses com sobra positiva e uma reserva mínima (valor que vocês definem).

### Agente no WhatsApp (fase final)
- "Gastei 80 no posto no cartão da Jô" → vira um lançamento.
- "Quanto sobra em dezembro?" → resposta com a visão do mês.
- "Posso comprar uma geladeira de 3.500 em 10x?" → resposta do simulador.

## 5. Tecnologia escolhida (e por quê)

| Parte | Escolha | Por quê |
|---|---|---|
| App | Site que funciona como app no celular (PWA) | Abre pelo navegador, vira ícone na tela, sem loja de aplicativos |
| Banco de dados e login | Supabase | Gratuito para esse tamanho, login para duas pessoas, dados na nuvem |
| Hospedagem | Vercel | Gratuita, publica sozinha a cada mudança no GitHub |
| WhatsApp | API oficial do WhatsApp + Claude | Lê as mensagens e conversa com o mesmo banco de dados |

Custo esperado no começo: **zero**. Custo pode aparecer só na fase do WhatsApp (por mensagem).

## 6. Fases

| Fase | O que entrega | Pronto quando |
|---|---|---|
| **0. Plano** | Este documento e o mapa de squads | Diego aprovar |
| **1. MVP: Registro** | Login dos dois, cadastros (pessoas, fontes, cartões com fechamento), lançar entradas e saídas, resumo do mês | Diego e Jô registram um mês inteiro pelo celular |
| **2. Cartões e meses futuros** | Regra de fechamento, parcelas, faturas futuras, contas fixas, visão de 12 meses | Dá para ver a sobra de cada mês até o fim de 2027 |
| **3. Simulador** | Comparação à vista x parcelado x adiar, reserva mínima | Primeira decisão real de compra tomada com o simulador |
| **4. Orçamento por categoria** | Limite por categoria, alerta de estouro | Um mês fechado comparando planejado x realizado |
| **5. WhatsApp** | Registrar e consultar pelo WhatsApp | Uma semana de lançamentos feitos só pelo WhatsApp |

## 7. O que falta o Diego e a Jô informarem

- [ ] Limite, dia de fechamento e dia de vencimento dos 3 cartões
- [ ] Valores do Studio Pilates e da Ajuda do Sady (mesmo que aproximados)
- [ ] O controle atual do Studio (planilha ou foto), para trazer o histórico
- [ ] Lista das contas fixas do mês (valor e dia de vencimento)
- [ ] Reserva mínima que querem manter em conta
- [ ] O e-mail que a Jô vai usar para entrar no sistema

## 8. Squads e agentes

Ver [mapa-de-squads.md](mapa-de-squads.md).
