# Módulo Admin Relacionamento

## Objetivo
Adicionar ao painel administrativo uma área simples de relacionamento com clientes, restrita aos administradores atuais, sem alterar login, permissões de produto, pagamentos, webhook ASAAS, Meta CAPI, XP, cursos, IAs ou biblioteca.

## Dados atuais que serão reaproveitados
- **Clientes:** nome, e-mail, criação da conta, plano e último acesso em `profiles`.
- **Telefone:** `asaas_customers` e, quando já preenchido, `profiles`.
- **Compras:** produto, situação, valor e datas em `asaas_payments` e `asaas_subscriptions`.
- **Produtos e combos:** nomes em `payment_products`; composição em `payment_product_bundles`.
- **Acessos:** `bst_product_access`, `user_course_access` e `student_categories`.
- **XP e uso:** XP atual de `profiles` somado aos eventos existentes de IA; atividade recente e progresso já consolidados pela função administrativa de progresso.
- **Administradores:** `user_roles` e `profiles`, usados para preencher o campo Responsável sem criar outro cadastro de pessoas.

## Novas estruturas realmente necessárias
1. **Relacionamento do cliente**
   - Um registro opcional por cliente.
   - Etapa, responsável, canal preferido, próxima oferta, complemento da oferta, último e próximo contato e notas internas.
2. **Histórico de relacionamento**
   - Registros cronológicos de contato com tipo, canal, responsável, observação e data/hora.
   - Mudanças de etapa também gerarão histórico, sem apagar registros anteriores.
3. **Configurações do módulo**
   - Mensagens sugeridas D0, D+1, D+3, D+7, D+14 e D+30.
   - Faixas configuráveis de baixo, médio e alto engajamento.

Todas terão acesso de dados restrito a ADMIN, com permissões e políticas no banco. Nenhum dado comercial será exposto aos alunos.

## Interface
- Adicionar **Relacionamento** ao menu ADMIN e criar a rota `/admin/relationship`.
- Criar resumo superior com: clientes novos, contatos de hoje, contatos atrasados e oportunidades Plano PRO.
- Criar filtros por nome/e-mail, etapa, produto, responsável e prazo do próximo contato.
- Exibir tabela responsiva com um cliente por linha e os campos definidos no documento.
- Abrir uma ficha lateral/detalhada ao selecionar um cliente, mostrando dados pessoais existentes, compras, acessos, XP, último acesso e dados de relacionamento.
- Permitir editar etapa, responsável, canal, próxima oferta, complemento, próximo contato e notas internas.
- Exibir régua D0 a D+30 calculada pela compra mais recente, tarefa atual e mensagem sugerida; não haverá envio automático.
- Permitir registrar contatos manualmente e mostrar histórico cronológico combinado com compras confirmadas.
- Exibir marcadores de atenção: resposta, múltiplos guias, XP alto, uso recente, D+7, D+14 e contato vencido.
- Adicionar área compacta para administradores editarem mensagens da régua e faixas de engajamento.

## Regras funcionais
- Considerar como clientes da lista usuários com pagamento confirmado/recebido ou assinatura vinculada.
- Resolver combos pelos produtos incluídos, mantendo o nome comercial do checkout na compra.
- Calcular a régua pela data da compra mais recente; contatos registrados atualizam o último contato, mas não apagam o histórico.
- Responsável será um administrador existente; os nomes iniciais aparecem se já forem administradores cadastrados.
- Nenhum e-mail, WhatsApp ou mensagem será enviado nesta versão.

## Validação
- Confirmar que um aluno não consegue ler ou alterar nenhum dado do módulo.
- Validar busca, todos os filtros, edição da ficha, mudança de etapa e criação do histórico.
- Validar cálculo de D+, contatos vencidos/hoje/futuros, XP e produtos/combo.
- Conferir a página em desktop e celular e confirmar que as áreas atuais continuam funcionando.
