# Automação de acesso por compra ASAAS

## Objetivo
Aplicar a matriz oficial do documento para que somente pagamentos confirmados liberem acessos, de forma cumulativa, idempotente, auditável e protegida no backend.

## Implementação

1. **Fechar a liberação antecipada**
   - Remover `PAYMENT_CREATED` do fluxo de concessão; cobranças pendentes serão apenas registradas.
   - Aceitar concessão somente nos estados/eventos de pagamento aprovados definidos pelo ASAAS.
   - Manter validação do token do webhook e confirmar os dados sensíveis no backend.

2. **Cadastrar a matriz comercial oficial**
   - Criar produtos separados para **PRO Adultos** e **PRO Kids & Teens**, preservando os planos OPEN existentes.
   - Atualizar os links oficiais de BST1, BST2, BST4 e BST5.
   - Manter BST3 e seu checkout atual, fora dos novos combos.
   - Criar os cinco combos: BST1+BST4, BST2+BST5, BST5+BST1+BST4, BST5+BST1 e BST5+BST4.
   - Vincular cada combo exclusivamente aos produtos descritos no documento.

3. **Permissões por origem e compra**
   - Registrar a origem por pagamento para cursos, BSTs, categorias e assinaturas.
   - Fazer novas compras apenas adicionarem acessos, sem remover os anteriores.
   - Impedir duplicação por reenvio do mesmo webhook/pagamento.
   - Preservar compras BST individuais quando uma assinatura PRO for cancelada.
   - Em estorno, retirar somente os acessos cuja única origem seja aquela transação; acessos iguais vindos de outra compra ou concessão administrativa permanecem.

4. **Regras dos planos PRO**
   - PRO Adultos libera cursos e recursos adultos definidos no plano, sem transformar a assinatura em vitalícia.
   - PRO Kids & Teens libera Kids e Teens e suas ferramentas, sem conteúdo exclusivo de Adultos.
   - Cancelamento/inadimplência altera somente os acessos da assinatura correspondente.

5. **Conta, e-mail e primeiro acesso**
   - Normalizar o e-mail, reutilizar conta existente e criar conta somente quando necessário.
   - Enviar apenas um e-mail seguro de ativação por compra inicial, com e-mail bloqueado/preenchido e sem expor senha ou token permanente.
   - Preservar o tutorial de instalação por dispositivo no primeiro acesso e a opção posterior de rever o tutorial.

6. **Administração e auditoria**
   - Exibir no painel ASAAS o produto/checkout identificado, usuário, pagamento, acessos concedidos, origem e resultado.
   - Manter concessão manual separada da origem ASAAS, sem sobrescrever compras.
   - Ajustar o cadastro administrativo de produtos para salvar categoria, produto BST e combos corretamente.

7. **Validação**
   - Testar os 11 checkouts, pagamento pendente versus confirmado, usuário novo/existente, reenvio idempotente, acesso direto bloqueado, combos exatos, acúmulo BST1 depois BST2+BST5 e cenário BST4 + PRO + cancelamento.
   - Validar e-mail/ativação, tutorial por dispositivo e estado final no painel administrativo.

## Detalhes técnicos
- A autorização continuará server-side por produto; a interface não será usada como barreira de segurança.
- A mudança de rastreabilidade será aditiva para preservar dados históricos.
- Registros antigos sem origem por transação não serão removidos automaticamente; apenas novas concessões terão revogação precisa por pagamento.
