# Experiência PRO e automação da escola

## Entrega imediata: experiência de R$5

Cadastrar os dois pagamentos avulsos, sem assinatura recorrente nem matrícula automática:

| Público | Checkout ASAAS | Acesso aos cursos |
| --- | --- | --- |
| Adultos | https://www.asaas.com/000/c/4d3sc7g8rky3eh40 | Adultos; Kids e Teens bloqueados |
| Kids e Teens | https://www.asaas.com/000/c/ghhwvyupo5eqiqyr | Kids e Teens; adultos bloqueados |

- R$5 por aluno, apenas uma experiência por aluno, com 30 dias contados da primeira confirmação de pagamento. Repetições de eventos ou novas compras não reiniciam o prazo.
- Ambos acessam as IAs, todos os PDFs e atividades BST, Bibliotecaê e Cantaê, respeitando a separação de cursos e materiais associados a cada público.
- Mostrar início, vencimento e condição de experiência no app; cursos excluídos aparecem bloqueados, inclusive quando abertos por link direto.
- Encerrar os acessos concedidos pela experiência ao completar os 30 dias, sem apagar XP, leituras, quizzes ou histórico. Compras BST e matrículas independentes continuam válidas. Cantaê conserva a regra anterior de acesso a todo usuário autenticado.
- Reutilizar o e-mail de primeiro acesso e criação de senha para novos clientes; quem já tem conta recebe confirmação, produto, prazo e instruções de login. Preservar o tutorial de instalação no primeiro acesso.
- Caso alguém pague novamente uma experiência já utilizada, registrar a ocorrência para atendimento, sem conceder novos 30 dias nem iniciar cobrança recorrente.

## Validade das compras BST

- Compras avulsas de qualquer BST concedem **um ano de acesso**, contado da confirmação do pagamento, ao PDF e às duas IAs daquele produto. Combos seguem o mesmo prazo para cada produto incluído.
- Bloquear o conteúdo comprado ao vencer o ano, sem apagar progresso, XP ou histórico e sem interferir em acesso independente por matrícula PRO/OPEN ativa.
- Exibir a validade na ficha de acesso e nas instruções de compra; não confundir o prazo do conteúdo com a recarga mensal de créditos.
- Aplicar o prazo também às compras anteriores, desde a confirmação original do pagamento, conforme sua decisão. Compras com mais de um ano já estarão vencidas na ativação da regra; informar a equipe antes dessa ativação.
- Ao vencer o ano, bloquear PDF e IAs e zerar os créditos BST remanescentes daquela concessão. Esta decisão substitui a regra anterior de saldo sem expiração. Não apagar créditos de outra compra ainda válida ou de uma matrícula ativa.

## Relacionamentos

- Identificar separadamente experiência de adultos e de Kids/Teens, com data de início, vencimento, dias restantes e situação ativa/encerrada/convertida em matrícula.
- Adaptar D0, D+1 e D+3 por e-mail à experiência PRO, com o destino correto no app, sem mensagens de comprador de Guia.
- Manter D+7 e D+14 como tarefas humanas e acrescentar uma tarefa humana D+27, três dias antes do vencimento, para Rosana ou o responsável administrativo. A mensagem comercial fica humana, não vira disparo automático de oferta.
- Interromper tarefas de conversão pendentes quando houver matrícula confirmada ou registro de desinteresse; não duplicar tarefas ou mensagens.
- Não incluir WhatsApp automático nesta etapa: permanece uma integração futura.

## Próxima etapa: contrato e matrícula

**Aguardando seu prompt com o contrato e os campos de cadastro.** Não gerar contrato jurídico, multa ou cobrança recorrente com termos inventados.

- Apresentar claramente R$147/mês para adultos ou R$126/mês para Kids/Teens **com compromisso anual**, versus R$210/mês sem compromisso anual. Os R$5 são uma experiência avulsa separada.
- Automatizar preenchimento, envio para assinatura pelo Adobe Acrobat Sign, acompanhamento da assinatura e acesso ao documento assinado.
- Integrar contrato, matrícula, pagamentos e contatos à ficha administrativa, sem expor notas comerciais aos alunos.
- Disponibilizar cancelamento fácil, com confirmação e acompanhamento. Após três mensalidades de matrícula efetivamente pagas, sem multa de rescisão, pagando o mês do cancelamento. A experiência não conta; as regras anteriores a esses três meses serão as do contrato que você enviará.
- Verificar a modalidade da conta Adobe e sua habilitação de integração antes de solicitar credenciais pelo formulário seguro. Uma conta Adobe comum não comprova acesso à API de assinatura.

**Atenção ao site comercial:** as LPs verificadas mostram R$147/R$126 por mês, mas não deixam o compromisso anual claramente estabelecido no texto consultado. Ajustar essa transparência no projeto Falaê Brasil Site, separadamente; este plano não modifica aquele projeto.

## Notas fiscais

**Aguardando configuração fiscal:** você confirmou que o ASAAS ainda não emite notas da escola.

- Validar com o contador a modalidade fiscal por oferta. A integração documentada de serviços do ASAAS emite **NFS-e**; NF-e de mercadorias usa outro fluxo. Não tratar recibo de pagamento como nota fiscal.
- Configurar os dados do emitente, município, regime tributário, serviço e tributos, além dos dados necessários do comprador.
- Após essa configuração, integrar emissão para cada pagamento confirmado, incluindo experiência, BST, combos e mensalidades, sem emissão duplicada.
- Acompanhar autorização ou erro fiscal, enviar a nota autorizada por e-mail e mostrar pendências para a equipe. Falha fiscal nunca deve impedir o acesso já pago.
- Tratar estornos e cancelamentos fiscais conforme orientação contábil, sem cancelar documentos silenciosamente.

## Relatórios de desempenho

O app já possui consulta de progresso por aluno e envio de relatório por e-mail pela equipe. A rotina mensal automática ainda precisa ser criada: consolidar período, evitar envio duplicado e registrar o envio na gestão interna. Reutilizar os dados existentes de cursos, quizzes, BST e IAs, sem modificar XP.

## Detalhes técnicos

- Criar concessões temporárias separadas das assinaturas e das liberações administrativas, vinculadas ao pagamento confirmado, com início, fim e público: 30 dias para experiência PRO e um ano para compras BST. Registrar a experiência utilizada de forma protegida; limite por aluno identificado, não apenas por link de checkout.
- Implementar concessão transacional e idempotente no fluxo ASAAS, validando produto, valor e confirmação. Não adicionar OPEN permanente, grants permanentes de todo o catálogo ou flags sem prazo para simular experiência.
- Verificar autorização no servidor a cada solicitação: cursos, aulas, vídeos, quizzes, materiais Leiaê/Memorizaê, PDFs assinados e funções de IA. A hierarquia atual permite adultos acessar Kids/Teens e precisa de uma exceção específica para experiências, sem alterar os direitos de alunos existentes.
- Derivar validade do horário atual no servidor; não depender de tarefa diária para bloquear no vencimento. Atualizar avisos e bloqueios no app sem exigir novo login. Revogação por estorno fica restrita à concessão de origem.
- Rastrear créditos BST por origem e validade para expirar somente o saldo associado ao acesso vencido, com débito/expiração idempotentes. Reconciliar o saldo histórico com os registros de concessão e uso; apresentar inconsistências à equipe, sem apagar saldo independente por suposição.
- Preservar liberações administrativas independentes, matrículas ativas, permissões administrativas, Meta Purchase e liberação/e-mail dos demais produtos; adaptar somente as compras BST ao prazo anual confirmado.
- As novas estruturas terão concessão de privilégios explícita e políticas de acesso; campos sensíveis não poderão ser alterados pelo aluno.
- Estender a gestão de relacionamentos existente, mantendo informações internas exclusivas de administradores.

## Validação antes de declarar funcionando

- Testar R$5, 30 dias exatos, limite de uma experiência, eventos duplicados, pagamento não confirmado e estorno.
- Testar um ano de acesso BST desde a confirmação para compras anteriores e futuras, incluindo combos, bloqueio, zeragem dos créditos associados, preservação de progresso e de outros créditos/acessos válidos.
- Testar adultos sem Kids/Teens e Kids/Teens sem adultos, inclusive por solicitações diretas ao servidor; testar acesso aos BSTs, Bibliotecaê e IAs.
- Testar o vencimento com sessão já aberta e confirmar que progresso e compras independentes são preservados.
- Verificar os dois caminhos de e-mail: novo cliente e cliente existente, acompanhando o resultado real de entrega. Não declarar entrega garantida apenas por chamar o envio.
- Testar tarefa D+27, mensagens iniciais, conversão e ausência de duplicações.
- Exercitar a jornada com contas de teste autenticadas, sem cobrar ou enviar mensagens a clientes reais como teste.
- Não declarar contratos Adobe, emissão fiscal ou rotina mensal automática operacionais antes de configurar e verificar suas respectivas integrações.

## Ordem de execução

1. Implementar e validar experiência de 30 dias, prazo anual e expiração de créditos dos BSTs, incluindo compras anteriores, e contatos de Relacionamentos.
2. Com seu contrato e os campos de cadastro, implementar matrícula, assinatura e cancelamento.
3. Com a configuração contábil pronta, ativar e validar notas fiscais.
4. Integrar o envio mensal de desempenho à gestão interna.
