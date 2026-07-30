## Objetivo

Transformar a Biblioteca BST em uma vitrine de **produtos BST** (guias/cartilhas low-ticket), cada um com ambiente blindado contendo PDF + IA Memorizaê BST + IA Falaê scripted (ou IA Leiaê, na Cartilha). Alunos OPEN/PRO/VIP continuam com acesso total; o aluno BST só acessa o produto que comprou.

## 1. Biblioteca BST (aluno)

- Remover as abas **Todos / E-books / Audiobooks**.
- Nova descrição: "Brasil Sem Trava: Guias, Cartilhas e Manuais - ferramentas de treinamento para uso prático em situações específicas."
- Lista **numerada em ordem alfabética** dos produtos BST (1., 2., 3. ...), com badge de bloqueado/liberado.
- Produto liberado → abre a página do produto. Produto bloqueado → modal de upsell com o link de checkout do produto.

## 2. Ambiente blindado do produto (`/library/:slug`)

Três ferramentas, dentro do próprio produto:

1. **PDF** — leitor em tela cheia com download liberado (mesmo componente das aulas).
2. **IA Memorizaê BST** — flashcards, SRS de 4 botões (Novamente/Difícil/Bom/Fácil) e TTS, idênticos ao existente, mas com baralhos exclusivos do produto.
3. **IA Falaê (scripted)** — apenas scripted, com scripts próprios do produto; sem unscripted.
   - No produto "BST Cartilha de Inglês Instrumental do Zero A1 ao C2 Avançado", a IA Falaê é substituída por **IA Leiaê** com textos próprios do produto.

Isolamento de conteúdo: os baralhos/cards, scripts e textos BST recebem vínculo com o produto e são **excluídos** das IAs do restante da plataforma (cursos FB e botões do painel), e vice-versa.

## 3. Aluno BST (restrito)

- Ao comprar um produto BST e se cadastrar, o aluno recebe acesso somente àquele produto e é levado direto para ele após o login.
- Ele navega livremente pela plataforma (cursos, IAs, dashboard) mas vê tudo **bloqueado com CTA de upgrade** — funciona como vitrine.
- Gamificação (XP) das atividades BST entra no XP total do aluno.

## 4. Painel admin (`/admin/library`)

- CRUD de **produtos BST**: título, slug, ordem/nome para ordenação alfabética, descrição, upload do PDF, ferramenta secundária (Falaê ou Leiaê), link de checkout ASAAS, ativo.
- Dentro de cada produto: gerenciar baralhos/cards do Memorizaê BST, scripts do Falaê BST e textos do Leiaê BST.
- Todo produto BST novo aparece automaticamente na lista.
- Em **Criar Aluno** e na gestão de alunos: toggles por produto BST, para o admin liberar manualmente.

## Detalhes técnicos

- Nova tabela `bst_products` (slug, title, description, pdf_url, secondary_tool, checkout_url, active, display_order) e `bst_product_access` (user_id, product_id) com RLS: aluno lê o próprio acesso; admin gerencia.
- Reaproveitar as tabelas existentes adicionando `bst_product_id` a `memorize_decks` e `leiae_texts`, mais nova tabela `bst_voice_scripts`. Todas as consultas atuais passam a filtrar `bst_product_id IS NULL`; as BST filtram pelo produto e exigem acesso via função `has_bst_product_access(uuid)` (SECURITY DEFINER).
- SRS/`user_card_reviews`, `submit_card_review`, `award_ai_xp` e `reset_all_progress` continuam servindo os dois mundos (XP com `source` já existente).
- Frontend: `src/pages/Library.tsx` reescrita como lista numerada; nova `src/pages/BstProduct.tsx` + componentes `BstMemorizae`, `BstVoiceScripted`, `BstLeiae` reutilizando a lógica atual; `PdfReader` com `allowDownload`.
- Admin: `src/pages/admin/LibraryManager.tsx` reescrito para produtos BST + sub-abas de conteúdo; `CreateStudent.tsx` com toggles dos produtos.
- Manter as tabelas/flags antigas (`library_bst`, `has_ebookN_access`) intactas para não quebrar histórico.

## Checkout ASAAS (passo a passo manual, entregue no fim)

Instruções para criar 3 links de cobrança avulsos no ASAAS (um por produto BST), preço único low-ticket, e colar cada link no campo "Checkout URL" do produto no admin — incluindo como o webhook já existente libera o acesso automaticamente.
