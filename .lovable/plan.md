# Plano: Combos + Cupons na plataforma + Migração pra produção

Duas frentes em paralelo. A parte de código eu faço; a parte de painel ASAAS é você.

---

## Parte 1 — Combos (order bumps "manuais")

Ideia: um "combo" é um **produto novo** no admin que, quando pago, libera **vários produtos de uma vez** (ex: Plano Open + 3 ebooks). Você cria 1 link de pagamento na ASAAS com o valor do combo, e o webhook libera todos os itens vinculados.

### O que eu construo
- Nova tabela `payment_product_bundles` (produto pai → produtos filhos)
- Admin → Pagamentos: no editor de produto, seção **"Itens inclusos (combo)"** com multi-select dos outros produtos ativos
- `grant_access_from_asaas` passa a: liberar o produto principal **+** todos os produtos vinculados como itens do combo (soma segundos de voz, marca acessos de ebook, libera cursos)
- Idempotência mantida via `access_granted_at`

### O que você faz
1. Cria no ASAAS o link do combo (ex: "Plano Open + 3 Ebooks" — R$ X)
2. Cria o produto no admin, cola o `checkout_url`, marca os 4 itens no combo, salva

---

## Parte 2 — Cupons via link alternativo

Ideia: você cria **um link de pagamento por preço** na ASAAS (preço cheio + preço com desconto) e distribui a URL "com cupom" só pra quem deve receber. A plataforma trata os dois como o mesmo produto lógico.

### O que eu construo
- Nova tabela `payment_product_coupons`: `product_id`, `code`, `checkout_url`, `price_cents`, `active`
- Admin → editor de produto: seção **"Cupons / links promocionais"** com CRUD (código, valor, URL do link ASAAS, ativo/inativo, botão copiar link)
- Página pública `/promo/:code` que:
  - Busca o cupom ativo, mostra o preço com desconto e o nome do produto
  - Botão "Ir para o checkout" abre o `checkout_url` do cupom
- Webhook: quando o pagamento chega, se o `paymentLink` bate com um `checkout_url` de cupom, credita o **mesmo produto pai** (libera os mesmos acessos, com o valor pago do cupom)

### O que você faz
1. Cria links extras no ASAAS com valores promocionais
2. No admin, adiciona cada cupom (código + URL + valor) dentro do produto
3. Divulga `https://app.falaebrasil.com.br/promo/BLACK20` pros clientes

---

## Parte 3 — Migração Sandbox → Produção

### O que você faz no painel ASAAS de PRODUÇÃO (`https://www.asaas.com`)
**A. Conta aprovada** — Minha Conta → completar dados PF/PJ, documentos, conta bancária. Aguardar liberação (~1 dia útil).

**B. Webhook**
- Integrações → Notificações via URL → Adicionar
- URL: `https://teastozdtgoogrpghpzj.supabase.co/functions/v1/asaas-webhook`
- Versão API: v3 · Envio: Sequencial
- Token: **o mesmo valor** salvo no backend como `ASAAS_WEBHOOK_TOKEN` (se você não lembra o valor, me avisa que eu gero um novo dos dois lados)
- Eventos: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`

**C. Recriar links de pagamento em produção** (sandbox não vale em prod):
1. Plano Open — assinatura mensal, valor real
2. Ebook 1, Ebook 2, Ebook 3 — cobrança única
3. (Opcional) Combo Open + 3 Ebooks
4. (Opcional) Links promocionais com valor de cupom

**D. Colar os links em Admin → Pagamentos**
- Cada produto recebe o `checkout_url` de produção
- Combos: marcar itens inclusos
- Cupons: cadastrar código + URL + valor

**E. Me avisar quando A–D estiverem prontos.**

### O que EU faço na virada
- Troco o secret `ASAAS_ENV` de `sandbox` → `production`
- A partir desse momento, toda compra vai pra sua conta real

---

## Ordem de execução do meu lado
1. Migração DB: `payment_product_bundles` + `payment_product_coupons`
2. Webhook + `grant_access_from_asaas`: suporte a combos e a cupons
3. Admin `PaymentsManager`: UI de combos e cupons dentro do editor de produto
4. Rota pública `/promo/:code`
5. Aguardar seu OK em A–D → virar `ASAAS_ENV=production`

Confirma que posso começar por 1–4 já?
