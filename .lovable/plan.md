# IA Memorizaê — Sistema de Repetição Espaçada (SRS)

Nova ferramenta baseada no algoritmo **SM-2** (o mesmo usado por Anki), integrada ao app Falaê Brasil! como "IA Memorizaê".

## 1. Onde vai aparecer

**Menu lateral** (`src/components/AppSidebar.tsx`): novo item **IA Memorizaê** entre "Cursos Falaê Brasil!" e "IA Falaê", com ícone `Brain` (lucide-react). Rota `/memorizae`.

**Menu admin** (`src/pages/admin/AdminLayout.tsx`): novo item **IA Memorizaê** com CRUD de decks e cartas.

## 2. Modelo de dados (novas tabelas no backend)

```text
memorize_decks
  id, course_id (fk, opcional), title, description,
  target_topic (enum: vocabulario_infinito | agilidade_mental | foco_dificil | geral),
  display_order, created_at

memorize_cards
  id, deck_id (fk), front_text, back_text,
  example_sentence, audio_url (opcional), image_url (opcional),
  display_order, created_at

user_card_reviews  -- estado SRS por (aluno, carta)
  id, user_id, card_id,
  ease_factor numeric default 2.5,
  interval_days int default 0,
  repetitions int default 0,
  due_at timestamptz default now(),
  last_reviewed_at timestamptz,
  last_rating smallint,             -- 0=Errei, 3=Bom, 5=Fácil
  lapses int default 0,
  UNIQUE(user_id, card_id)
```

Grants + RLS:
- `memorize_decks` / `memorize_cards`: SELECT para `authenticated` (respeitando `has_course_access` quando `course_id` estiver definido), full para admins.
- `user_card_reviews`: aluno lê/escreve só as próprias linhas.

Função `submit_card_review(_card_id uuid, _rating int)` (SECURITY DEFINER) implementa **SM-2**:
- rating 0 (Errei): repetitions=0, interval=1 dia, ease-=0.2, lapses+=1
- rating 3 (Bom): se rep=0 → 1d; se rep=1 → 3d; senão interval*ease; rep+=1
- rating 5 (Fácil): igual Bom mas ease+=0.15; se rep=0 → 4d
- ease mínimo 1.3
- retorna `{ next_due_at, interval_days, ease_factor }`

## 3. Página do aluno — `/memorizae`

Arquivo: `src/pages/Memorizae.tsx`

Layout:
- Cabeçalho explicativo curto (curva do esquecimento) — 1 parágrafo, dispensável.
- Lista de **decks** com contadores: `pendentes hoje` / `novas` / `total`.
- Ao entrar num deck → **modo revisão**:
  1. Frente da carta (frase em inglês em destaque).
  2. Botão "Mostrar resposta" revela verso (tradução + exemplo + áudio se houver).
  3. Três botões de feedback: **Errei** (vermelho), **Bom** (azul), **Fácil** (verde). Cada um mostra o intervalo previsto ("+10min", "+3d", "+7d").
  4. Chama `submit_card_review`, avança para a próxima carta devida.
  5. Ao esgotar a fila: tela de "Sessão concluída" com stats (revisadas, acertos, próxima revisão).

Regras de fila (frontend query):
- Cartas com `due_at <= now()` ordenadas por `due_at`.
- Se aluno nunca viu a carta (sem linha em `user_card_reviews`), tratar como "nova" — limite configurável (20 novas/dia por deck).

## 4. Painel admin — `/admin/memorizae`

Arquivo: `src/pages/admin/MemorizaeManager.tsx` (mesmo padrão de `PromptsManager.tsx`).

- Seletor de curso (opcional — decks podem ser globais).
- Lista de decks: criar / editar / excluir. Campos: título, descrição, `target_topic`, ordem.
- Ao abrir um deck: lista de cartas com criar / editar / excluir. Campos: frente, verso, exemplo, URL de áudio, URL de imagem.
- Importação rápida em lote via textarea (uma carta por linha, `frente | verso | exemplo`) — nice-to-have.

## 5. Ligação com os 5 objetivos citados

Todos os 5 pontos são atendidos pelo mesmo motor SM-2. O que muda é como comunicamos ao aluno via `target_topic` do deck e cópias na UI:

| Objetivo | Como aparece na ferramenta |
|---|---|
| Destruir Curva do Esquecimento | Motor SM-2 agenda revisões no intervalo ideal |
| Revisão Inteligente | Fila diária mostra só o que está devido |
| Foco no que é Difícil | Cartas com rating "Errei" voltam em minutos; `lapses` marca cartas problemáticas com badge "Difícil" |
| Vocabulário Infinito | Contador global de cartas dominadas (ease ≥ 2.5 e interval ≥ 21d) no header da página |
| Agilidade Mental | Timer opcional por carta + sessão curta (default 10min ou 20 cartas) |

## 6. Ordem de execução

1. Migração: 3 tabelas + grants + RLS + função `submit_card_review`.
2. Item de menu no sidebar + rota em `App.tsx`.
3. Página `Memorizae.tsx` (lista de decks + modo revisão).
4. Item admin + página `MemorizaeManager.tsx`.
5. Traduções `nav.memorizae` em `LanguageContext`.

## Detalhes técnicos

- Ícone: `Brain` de `lucide-react`.
- Componentes shadcn já existentes: Card, Button, Dialog, Badge, Progress, Table.
- Sem novas dependências.
- Áudio da carta: `<audio>` HTML nativo, arquivo em bucket `lesson-files` (público, já existe).
- Nenhuma alteração em outras features.

Confirma que posso seguir com essa implementação?
