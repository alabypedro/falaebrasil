# Plano PRO recorrente mensal (R$147 adultos / R$126 Kids-Teens)

## Objetivo
Fechar o fluxo ponta a ponta: aluno sai da Experiência PRO (R$5/30 dias), assina o plano mensal pelo link ASAAS, e a cada pagamento confirmado o acesso é estendido automaticamente por mais um mês — sem ação do aluno — com lembretes amigáveis antes do vencimento e gestão completa no Admin.

## O que já existe (não será refeito)
- Os dois links ASAAS já são **assinaturas mensais recorrentes** (cartão habilitado).
- O webhook já registra assinaturas (`asaas_subscriptions`), renova/cancela acesso e mostra aviso de pagamento pendente no app.
- Já existe função de cancelamento de assinatura e relatório mensal de progresso do aluno.

## 1. Cadastro dos produtos
- Criar dois produtos de assinatura mensal no sistema:
  - **PRO Mensal Adultos** — R$147/mês — link `57t5yjkcfmj757rl`
  - **PRO Mensal Kids/Teens** — R$126/mês — link `qhk5xkozqahjvmul`
- Cada um libera os cursos do seu público (Adultos ou Kids/Teens), mantendo o acesso geral a BST, Bibliotecaê e Cantaê.

## 2. Conversão Experiência → Plano PRO (automática)
- Quando o pagamento da assinatura for confirmado para um aluno que está na Experiência PRO:
  - O acesso passa de "experiência de 30 dias" para **assinante ativo**, sem interrupção.
  - O aviso de "Experiência PRO — X dias restantes" some e dá lugar ao status de assinante.
- A cada nova cobrança mensal confirmada, o acesso é estendido até o próximo vencimento (o ASAAS já cobra sozinho todo mês no mesmo dia do primeiro pagamento — a regra do dia 17→17, 31→30 é dele; nós apenas obedecemos a data que ele informa).

## 3. Lembretes amigáveis de cobrança (e-mail)
- Nova rotina automática diária que envia:
  - **3 dias antes** do vencimento: lembrete amigável.
  - **Na véspera**: lembrete.
  - **No dia**: aviso de que a cobrança será feita automaticamente (cartão/Pix Automático).
- Se o pagamento falhar: aviso de regularização (já existe o banner no app; adicionamos e-mail) e o acesso entra no período de tolerância já existente antes de bloquear.

## 4. Pix Automático e cartão — o que você precisa fazer no ASAAS
- **Cartão**: já está ativo nos dois links. Nada a fazer.
- **Pix Automático** (débito mensal sem o aluno copiar/colar): precisa ser habilitado na sua conta ASAAS (menu Pix → Pix Automático) e o aluno autoriza uma única vez no primeiro pagamento. Se não aparecer no painel, peça ao suporte ASAAS a ativação do Pix Automático para assinaturas.
- Os links continuam oferecendo as duas opções; o aluno escolhe.

## 5. Ferramenta no Admin: "Assinaturas PRO"
Nova página no Admin com:
- **Alunos ativos pagantes**: nome, plano (Adultos/Kids-Teens), dia de vencimento, valor, status.
- **Recebíveis do mês**: total previsto (soma das assinaturas ativas) e total já confirmado.
- **Arquivo morto**: ex-assinantes (cancelados/inadimplentes), com data de saída — alimenta o módulo Relacionamentos para reativação.
- Ações: cancelar assinatura, ver histórico de pagamentos.

## 6. Contrato anual e cancelamento
- O contrato de 12 meses (compromisso psicológico, rescisão sem multa após 3 mensalidades pagas) segue o item já no roadmap: preenchimento automático + assinatura digital Adobe — continua pendente da configuração da Adobe e não bloqueia este plano.
- A regra de cancelamento (mínimo 3 meses pagos) será aplicada na ferramenta de cancelamento do Admin.

## 7. Relatórios
- Relatório mensal ao aluno (progresso) já existe — vou conferir e ligar à rotina automática.
- Relatório administrativo mensal (ativos, recebíveis, cancelamentos) entra na nova página do Admin.

## Ordem de execução
1. Cadastrar os 2 produtos de assinatura e ligar aos links.
2. Webhook: conversão Experiência→PRO e extensão mensal de acesso.
3. Rotina de lembretes por e-mail (D-3, D-1, D0, falha).
4. Página Admin "Assinaturas PRO" (ativos, recebíveis, arquivo morto).
5. Teste ponta a ponta com compra real ou simulada.

## Fora deste plano (já no roadmap)
- NFS-e (em stand-by por sua decisão).
- Validade de 1 ano dos BST.
- Contrato Adobe (depende de configuração externa).
