# Falaê Brasil — Relatório de Migração

Documentação completa da migração do projeto **Falaê Brasil** da infraestrutura gerenciada pelo Lovable Cloud para infraestrutura própria (Supabase externo + Vercel).

---

## Visão Geral

O projeto Falaê Brasil é uma plataforma de aprendizado de inglês com funcionalidades de pronúncia via IA (Azure Speech), quizzes, lições em vídeo, comunidade, sistema de XP e integração com pagamentos via Hubla.

Antes da migração, toda a infraestrutura (banco de dados, autenticação, funções backend, storage) era gerenciada automaticamente pelo Lovable Cloud. Após a migração, o projeto passa a rodar em:

- **Banco de dados + Auth + Storage:** Supabase próprio (`qiuqmowxwlqnjhlqvxzw`)
- **Backend (Edge Functions):** Supabase Edge Functions (Deno)
- **Frontend:** Vercel, com deploy automático via GitHub
- **Domínio:** `https://app.falaebrasil.com.br` (DNS via Cloudflare)
- **Email transacional:** Resend (`noreply@falaebrasil.com.br`)

---

## O que foi migrado

### 1. Banco de Dados — 38 tabelas

Todo o schema foi recriado no novo Supabase usando 5 arquivos SQL executados em ordem:

| Arquivo | Conteúdo |
|---|---|
| `01_schema.sql` | Extensões, ENUMs, 38 tabelas, FKs, índices, GRANTs, RLS habilitado |
| `02_functions.sql` | 30 funções SQL/PLpgSQL (`has_role`, `submit_quiz`, etc.) |
| `03_triggers.sql` | 20 triggers (`updated_at`, XP sync, proteção de perfil, etc.) |
| `04_policies.sql` | 111 políticas RLS |
| `05_data.sql` | ~3.000 registros carregados via INSERT |

Contagem de registros após migração:

| Tabela | Registros |
|---|---|
| profiles | 90 |
| courses | 14 |
| modules | 42 |
| lessons | 168 |
| lesson_videos | 310 |
| quiz_questions | 460 |
| quizzes | 48 |
| listening_lessons | 33 |
| voice_sessions | 313 |
| chat_sessions | 341 |
| chat_messages | 136 |
| user_roles | 4 |
| email_send_log | 307 |
| user_video_progress | 435 |
| voice_credit_grants | 127 |
| + 23 outras tabelas | ✅ |

---

### 2. Usuários (auth.users)

O Lovable Cloud não permite exportar hashes de senha nem acesso direto ao schema `auth`. Por isso:

- Os 89 usuários foram recriados no novo Supabase via **Admin API**, preservando os **UUIDs originais** de cada usuário (garantindo que todos os dados em `public.profiles` continuem ligados corretamente).
- Todos os emails foram **confirmados automaticamente** via `email_confirm: true`.
- Um email de **redefinição de senha** foi enviado para os 87 usuários válidos via Resend, com link direto para `https://app.falaebrasil.com.br`.

---

### 3. Edge Functions — 17 funções

Todas as funções foram deployadas via Supabase CLI:

| Função | JWT Verify | Descrição |
|---|---|---|
| `auth-email-hook` | desativado | Hook de emails customizados de auth |
| `hubla-webhook` | desativado | Recebe eventos de compra da Hubla |
| `azure-pronunciation` | ativado | Avalia pronúncia via Azure Speech |
| `pronunciation-feedback` | ativado | Feedback de pronúncia |
| `generate-unscripted-topic` | ativado | Gera tópicos livres via Azure OpenAI |
| `generate-writing-topic` | ativado | Gera tópicos de escrita |
| `writing-listening-chat` | ativado | Chat de escrita e listening |
| `grant-access-admin` | ativado | Concede acesso manualmente (admin) |
| `grant-access-bulk` | ativado | Concede acesso em massa |
| `grant-voice-credits-admin` | ativado | Gerencia créditos de voz (admin) |
| `manage-admins` | ativado | Gerencia administradores |
| `parse-prompts` | ativado | Processa prompts |
| `process-email-queue` | ativado | Processa fila de emails |
| `push-notifications-cron` | ativado | Envia push notifications |
| `send-welcome-email-admin` | ativado | Envia email de boas-vindas (admin) |
| `set-plan-tier-admin` | ativado | Define tier de plano (admin) |
| `test-push-notification` | ativado | Testa push notification |

**Secrets configurados (9):**
- `AZURE_OPENAI_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`
- `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `AZURE_SPEECH_ENDPOINT`
- `HUBLA_WEBHOOK_SECRET`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

---

### 4. Storage — 6 buckets

| Bucket | Visibilidade | Arquivos migrados |
|---|---|---|
| `avatars` | Público | 1 avatar |
| `lesson-files` | Público | 33 PDFs (A1, A2, B1) |
| `recordings` | Privado | 0 (vazio no projeto original) |
| `community-audio` | Privado | 0 (vazio no projeto original) |
| `contracts` | Privado | 0 (sem arquivos enviados) |
| `listening-images` | Privado | 0 (imagens armazenadas no banco) |

Os vídeos das lições são links do YouTube — sem necessidade de migração.

O Lovable não fornece acesso à `service_role` do projeto antigo, então os buckets privados não puderam ser migrados automaticamente. Como estavam vazios, não há perda de dados.

---

### 5. Autenticação e Email

- **Site URL:** `https://app.falaebrasil.com.br`
- **Redirect URLs:** `https://app.falaebrasil.com.br/**`, `http://localhost:5173/**`
- **SMTP:** Resend via `smtp.resend.com:465`
- **Remetente:** `Falaê Brasil <noreply@falaebrasil.com.br>`
- **Domínio verificado no Resend:** `falaebrasil.com.br` (SPF/MX via Cloudflare)

---

### 6. Cron Jobs

Dois jobs criados via `pg_cron`:

| Job | Schedule | Função |
|---|---|---|
| `process-email-queue` | `* * * * *` (a cada minuto) | Processa fila de emails |
| `push-notifications-cron` | `0 * * * *` (a cada hora) | Envia push notifications |

---

### 7. Frontend — Deploy na Vercel

- Repositório GitHub: `https://github.com/alabypedro/falaebrasil`
- Deploy automático a cada `git push` na branch `main`
- `vercel.json` criado com rewrite para SPA (React Router funciona em todas as rotas)
- Variáveis de ambiente atualizadas no `.env`:

```
VITE_SUPABASE_URL=https://qiuqmowxwlqnjhlqvxzw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=qiuqmowxwlqnjhlqvxzw
```

---

### 8. DNS — Cloudflare

Registro atualizado de `185.158.133.1` (Lovable) para `76.76.21.21` (Vercel):

| Tipo | Nome | Valor | Proxy |
|---|---|---|---|
| A | `app` | `76.76.21.21` | Proxied |

---

### 9. Hubla Webhook

URL do webhook atualizada no painel da Hubla para:
```
https://qiuqmowxwlqnjhlqvxzw.supabase.co/functions/v1/hubla-webhook
```

O endpoint valida a assinatura `HUBLA_WEBHOOK_SECRET` em toda requisição recebida.

---

## Verificação de Funcionamento

Verificação automatizada realizada via Playwright (Chromium headless) em `https://app.falaebrasil.com.br`:

| Verificação | Resultado |
|---|---|
| HTTP Status | ✅ 200 OK |
| Título da página | ✅ `"Entrar — Falaê Brasil"` |
| React app renderizado | ✅ Conteúdo correto na tela |
| Formulário de login (email + senha) | ✅ Encontrado e funcional |
| Supabase antigo (`teastozdtgoogrpghpzj`) | ✅ Zero chamadas |
| Erro com credenciais inválidas | ✅ `"Invalid login credentials"` exibido corretamente |
| Erros de JavaScript | ✅ Nenhum erro crítico |

**Observação:** Erro de Push Notification no modo headless é esperado (Chrome bloqueia Push API em modo incógnito) e não afeta usuários reais.

---

> ⚠️ O editor do Lovable ainda está conectado ao mesmo repositório GitHub. Edições pelo editor chegam via GitHub na Vercel, mas o Lovable pode regenerar o `.env` com credenciais antigas. Prefira editar localmente. Foi aberto ticket no suporte do Lovable para desconectar o Cloud.

---

## Pendências

| Item | Status |
|---|---|
| Desconexão do Lovable Cloud | ⏳ Aguardando resposta do suporte |

---

## Suporte Lovable — Histórico

### Tentativa de migração de auth.users e service_role key
> "Infelizmente, ambos os itens que você precisa não estão disponíveis no Lovable Cloud. Isso é uma limitação da plataforma que não pode ser contornada nem pela equipe de suporte: pg_dump / DATABASE_URL / service_role key: O Lovable Cloud é um serviço totalmente gerenciado. Os projetos Supabase subjacentes não são acessíveis ao usuário, e essas credenciais não podem ser fornecidas por nenhum membro da equipe Lovable. Export de auth.users com encrypted_password: Não é possível exportar os hashes de senha. Após a migração, todos os usuários precisarão redefinir suas senhas no novo projeto Supabase."
>
> — Sam, Lovable AI Support Agent

### Solicitação de desconexão do Lovable Cloud
> "Olá! Obrigado por entrar em contato! Vejo que você já tem um chamado aberto sobre a migração do seu projeto falaebrasil. Unifiquei seus chamados para que possamos manter tudo em um só lugar e ajudá-lo(a) com mais eficiência. Você pode continuar a conversa no seu chamado original e alguém entrará em contato em breve."
>
> — Sam, Lovable AI Support Agent
