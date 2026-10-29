# Plano do sistema FINANÇAS

Versão 2 · 29/10/2026 · Diego e Jô

## 1. O que o sistema resolve

Um lugar só, fácil de usar no celular, onde Diego e Jô veem **em tempo real como está o mês atual e o mês seguinte**, a partir de:

- o **extrato do banco** (entradas e saídas que já aconteceram);
- as **faturas dos cartões** (o que já está comprometido, inclusive parcelas);
- os **lançamentos do dia a dia** feitos por vocês (dinheiro, pix, cartão).

A pergunta principal que a tela inicial responde: **"Quanto vai sobrar no mês que vem?"**

## 2. Os dois conceitos, em linguagem simples

| | Fluxo de caixa | Orçamento |
|---|---|---|
| O que é | O que **já aconteceu** | O que **está previsto** |
| Exemplo | "Paguei R$ 230 no mercado, no pix" | "Dia 5 entra a Plantrix, dia 10 vence a fatura" |
| De onde vem | Extrato do banco e lançamentos | Rendas fixas, contas fixas, faturas e parcelas |

O sistema junta os dois: **saldo de hoje + o que ainda vai entrar − o que já está comprometido = sobra prevista** do mês atual e do seguinte.

## 3. Experiência de uso (prioridade do projeto)

O sistema só funciona se for usado todo dia. Por isso, as regras de design:

1. **Tela inicial com uma resposta só:** sobra prevista deste mês e do mês seguinte, em número grande, com cor (verde, amarelo, vermelho).
2. **Lançar em até 3 toques:** botão "+" sempre visível; valor, forma de pagamento, pronto. O resto (descrição, categoria) é opcional.
3. **O sistema adivinha o óbvio:** data de hoje, quem está logado, último cartão usado, categoria pela descrição.
4. **Nada de termo técnico na tela:** "Sobra em dezembro", não "saldo projetado".
5. **Feito para celular primeiro:** botões grandes, uma mão só, funciona como app instalado (ícone na tela).
6. **Importar o extrato sem trabalho:** subir o PDF do banco e o sistema separa o que já estava lançado (não duplica).
7. **Testado com vocês dois:** cada tela nova passa pela Jô e pelo Diego antes de ser considerada pronta.

## 4. Cadastros básicos

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

### Contas bancárias
Cada conta (banco de cada um) é cadastrada uma vez. O extrato importado entra na conta certa.

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

**Regra da fatura:** compra feita **até** o dia de fechamento entra na fatura que vence neste mês. Compra feita **depois** do fechamento entra na fatura **seguinte**. O sistema calcula isso sozinho e mostra, por exemplo: "Esta compra vai para a fatura de dezembro".

Compra parcelada gera uma parcela em cada fatura futura, seguindo a mesma regra.

### Categorias
No começo, o controle é **geral** (só a sobra do mês). Cada lançamento já pode receber uma categoria opcional (mercado, casa, saúde, lazer...), para que depois seja fácil ligar o **orçamento por categoria** sem perder o histórico.

## 5. Funcionalidades

### Painel (tela inicial)
- Sobra prevista do **mês atual** e do **mês seguinte**, atualizada a cada lançamento ou importação.
- Abaixo, o que compõe o número: rendas que ainda vão entrar, contas fixas, faturas de cada cartão.
- Toque em qualquer item para ver os detalhes.

### Lançamentos do dia a dia
- Entrada ou saída em até 3 toques: valor, forma de pagamento, cartão e parcelas (se for crédito).
- Contas fixas e recorrentes cadastradas uma vez e repetidas todo mês.
- Lista do mês com filtro por pessoa, forma de pagamento e fonte de renda.

### Importação do extrato e da fatura
- Bancos de vocês: **Mercado Pago, Nubank e Sicredi**.
- Formato principal: **PDF**, que é o que os apps desses bancos geram. Você sobe o PDF da fatura ou do extrato e o sistema lê as linhas (data, descrição, valor, parcela).
- A leitura do PDF é feita com IA (Claude), porque cada banco monta o PDF de um jeito. Custo estimado: centavos por arquivo.
- O sistema reconhece o que já foi lançado à mão e não duplica.
- O que for novo aparece numa lista para vocês conferirem e confirmarem com um toque. Nada entra sem confirmação.
- Se algum banco também exportar CSV ou OFX, o sistema aceita.
- Futuro: conexão automática com o banco (Open Finance), para não precisar subir arquivo.

### Cartões
- Fatura atual e próximas faturas de cada cartão.
- Limite usado e limite livre, contando as parcelas futuras.
- Aviso quando a fatura estiver perto do vencimento.

### Fechamento do mês
- Resumo curto: o que entrou por fonte (Plantrix, Studio, Sady), o que saiu, o que sobrou.

## 6. Tecnologia escolhida (e por quê)

| Parte | Escolha | Por quê |
|---|---|---|
| App | Site que funciona como app no celular (PWA) | Abre pelo navegador, vira ícone na tela, sem loja de aplicativos |
| Banco de dados e login | Supabase | Gratuito para esse tamanho, login para duas pessoas, dados na nuvem |
| Hospedagem | Vercel | Gratuita, publica sozinha a cada mudança no GitHub |

Custo esperado: **zero** nesta etapa.

## 7. Fases

| Fase | O que entrega | Pronto quando |
|---|---|---|
| **0. Plano** | Este documento e o mapa de squads | Diego aprovar |
| **1. Base** | Login dos dois, cadastros (pessoas, fontes, contas, cartões com fechamento), lançar entradas e saídas, painel do mês atual | Diego e Jô lançam uma semana inteira pelo celular sem dificuldade |
| **2. Mês seguinte** | Regra de fechamento, parcelas, faturas futuras, contas fixas, painel com o mês seguinte | O painel mostra a sobra do mês que vem e bate com a conta feita à mão |
| **3. Extrato e fatura** | Importar o PDF da fatura e do extrato (Mercado Pago, Nubank, Sicredi), sem duplicar | Um mês inteiro importado e conferido |
| **4. Orçamento por categoria** | Limite por categoria e alerta de estouro | Um mês fechado comparando previsto x realizado |
| Depois | Conexão automática com o banco, agente no WhatsApp | Fora do escopo agora |

## 8. O que falta o Diego e a Jô informarem

- [ ] Limite, dia de fechamento e dia de vencimento dos 3 cartões
- [ ] Um PDF de fatura e um de extrato de cada banco (pode tapar dados pessoais), para testar a leitura
- [ ] Valores do Studio Pilates e da Ajuda do Sady (mesmo que aproximados)
- [ ] O controle atual do Studio (planilha ou foto), para trazer o histórico
- [ ] Lista das contas fixas do mês (valor e dia de vencimento)
- [ ] O e-mail que a Jô vai usar para entrar no sistema

## 9. Squads e agentes

Ver [mapa-de-squads.md](mapa-de-squads.md).
