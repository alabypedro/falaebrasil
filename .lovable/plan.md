# Migração Hubla → ASAAS

## Passo a passo do que você precisa fazer no ASAAS (antes de eu codar)

1. **Pegar API Key**
   - Painel ASAAS → menu do usuário (canto superior direito) → **Integrações** → **Gerar nova chave de API**
   - Gere **duas**: uma em **Sandbox** (`https://sandbox.asaas.com`) para testes e outra em **Produção**
   - Guarde as duas — vou pedir via formulário seguro quando chegar a hora

2. **Configurar Webhook**
   - Menu do usuário → **Integrações** → **Notificações via URL**
   - URL: `https://teastozdtgoogrpghpzj.supabase.co/functions/v1/asaas-webhook` (vou criar essa function no passo 3 do desenvolvimento)
   - Token de autenticação: gere uma string forte (você define) — vou pedir também
   - Eventos marcados: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_DELETED`

3. **Criar os produtos base** (opcional — podemos gerenciar tudo pelo nosso admin)
   - ASAAS não tem "catálogo de produtos" nativo como Hubla; cada cobrança é criada via API com valor/descrição. Vou modelar isso na nossa tabela `payment_products` do lado do Lovable.

---

## O que vou construir (desenvolvimento)

### 1. Banco de dados (migração única)
Criar novas tabelas paralelas às `hubla_*` e adicionar colunas em `profiles`:

- **`payment_products`**: substitui `hubla_product_mapping`. Colunas: `product_key` (`plano_open`, `ebook_anfitriao`, `ebook_decodificador`, `ebook_vocabulario`), `name`, `type` (`subscription` | `one_time`), `price_cents`, `billing_cycle` (`MONTHLY`/`YEARLY`/`null`), `description`, `active`, `grants_course_access`, `grants_ebook1/2/3_access`, `grants_scripted_seconds`, `grants_unscripted_seconds`, `plan_tier`
- **`payment_product_courses`**: substitui `hubla_product_courses` (product_id → course_id)
- **`asaas_customers`**: mapeia `user_id` ↔ `asaas_customer_id`
- **`asaas_subscriptions`**: `user_id`, `asaas_subscription_id`, `product_key`, `status`, `next_due_date`, `cycle`
- **`asaas_payments`**: log de todas as cobranças (`asaas_payment_id`, `user_id`, `product_key`, `status`, `value`, `billing_type`, `invoice_url`, `pix_qr_code`, `paid_at`)
- **`asaas_webhook_events`**: idempotência dos webhooks (`event_id` PK, `event_type`, `raw_payload`, `processed_at`)
- **`profiles`**: adicionar `asaas_customer_id`, `asaas_subscription_id` (manter os `hubla_*` como histórico read-only)

Novo RPC `grant_access_from_asaas(_user_id, _asaas_payment_id, _product_key, _raw)` que substitui `grant_voice_credits` — idempotente por `asaas_payment_id`, concede acessos e créditos conforme o `payment_products`.

Tabelas `hubla_*` **não são deletadas** (histórico), mas ficam invisíveis no admin.

### 2. Edge functions

- **`asaas-webhook`** (`verify_jwt = false`): valida header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN`, insere no `asaas_webhook_events` com idempotência, roteia por `event.event`:
  - `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → chama `grant_access_from_asaas`, marca profile `subscription_status='active'`, atualiza `subscription_current_period_end`
  - `PAYMENT_OVERDUE` → `subscription_status='past_due'`, define `subscription_grace_until = now() + 7 dias`
  - `SUBSCRIPTION_DELETED`/`PAYMENT_REFUNDED` → `subscription_status='canceled'`, revoga acessos após grace
- **`asaas-create-checkout`** (chamada pelo frontend, `verify_jwt=true`): recebe `product_key`, cria/reusa `asaas_customer_id`, cria assinatura (para plano OPEN) ou cobrança única (para ebooks) via API ASAAS (`POST /v3/subscriptions` ou `/v3/payments`), retorna `invoiceUrl`/PIX/link para o aluno pagar
- **`asaas-cancel-subscription`** (`verify_jwt=true`): admin cancela via `DELETE /v3/subscriptions/{id}`
- **Remover/depreciar** `hubla-webhook` (mantenho o arquivo com um `410 Gone` por 30 dias para não quebrar webhooks antigos)
- Adaptar `grant-voice-credits-admin` e `grant-access-admin` para usar as novas tabelas

### 3. Admin panel

- Renomear rota `/admin/hubla` → `/admin/payments`
- **`PaymentProductsManager.tsx`** (substitui `HublaProductsManager`): CRUD dos produtos ASAAS, define acessos concedidos, cursos vinculados, preço, ciclo. Aba separada "Legado Hubla" (read-only) mostra o histórico.
- Nova aba **"Assinaturas ASAAS"**: lista `asaas_subscriptions` com filtro por status, botão de cancelar
- Nova aba **"Pagamentos"**: lista `asaas_payments` com filtro por status/data, link para `invoiceUrl`

### 4. Frontend do aluno

- `SubscriptionStatusBanner`: passa a ler de `asaas_subscriptions` + `payment_products` para pegar link de repagamento (nova API `POST /v3/payments/{id}/refund` não se aplica aqui — usamos o `invoiceUrl` da última cobrança em aberto)
- `UpsellModal`: chama `asaas-create-checkout` em vez de abrir `checkout_url` estático → retorna `invoiceUrl` que abre em nova aba (PIX/cartão/boleto na tela do ASAAS)
- `UpgradeButton`: idem — cria assinatura sob demanda
- `Success.tsx`: continua igual (polling do profile), só muda a fonte dos dados

### 5. Secrets necessárias
- `ASAAS_API_KEY` (produção)
- `ASAAS_API_KEY_SANDBOX` (para testar antes de virar live)
- `ASAAS_WEBHOOK_TOKEN` (mesmo valor que você configura no painel ASAAS)
- `ASAAS_ENV` = `sandbox` ou `production` (para o código escolher qual URL/key usar)

---

## Ordem de execução (proposta)

1. **Migração de banco** (tabelas + RPC novo + colunas em `profiles`)
2. **Peço as 4 secrets** via formulário seguro
3. **Edge functions ASAAS** (`asaas-webhook` + `asaas-create-checkout` + cancel)
4. **Admin novo** (`PaymentProductsManager` + Assinaturas + Pagamentos)
5. **Frontend** (`UpsellModal`, `UpgradeButton`, `SubscriptionStatusBanner`)
6. **Depreciar `hubla-webhook`** e esconder tela antiga
7. **Você popula** os 4 produtos no admin novo (Plano OPEN mensal + 3 ebooks)
8. **Teste em sandbox**: eu te guio para trocar `ASAAS_ENV=sandbox`, fazer uma compra teste, ver o webhook chegar, o acesso liberar
9. **Vira produção**: `ASAAS_ENV=production`

## O que NÃO vou fazer (para não quebrar)
- Não deleto tabelas `hubla_*` — viram histórico
- Não migro automaticamente alunos ativos do Hubla para ASAAS (impossível sem eles reautorizarem cartão). Você vai precisar avisá-los e recriar as assinaturas no ASAAS. Enquanto isso os acessos deles permanecem porque `has_course_access=true` no profile não é revogado pela migração.

## Detalhes técnicos relevantes

**API ASAAS base URLs:**
- Sandbox: `https://sandbox.asaas.com/api/v3`
- Prod: `https://api.asaas.com/v3`

**Autenticação:** header `access_token: <API_KEY>` (não é Bearer)

**Criação de cliente:** `POST /customers` com `{name, email, cpfCnpj?}` — CPF é opcional na sandbox, obrigatório em prod para boleto/PIX. Vou coletar CPF do aluno no fluxo de checkout se ainda não tiver no profile.

**Assinatura:** `POST /subscriptions` com `{customer, billingType: 'UNDEFINED', value, nextDueDate, cycle: 'MONTHLY', description}`. `UNDEFINED` deixa o aluno escolher PIX/cartão/boleto na hora.

**Webhook idempotência:** ASAAS reenvia até receber HTTP 200. `event.id` como chave única no `asaas_webhook_events`.

---

Confirma que a ordem e o escopo estão bons e eu começo pela migração de banco?