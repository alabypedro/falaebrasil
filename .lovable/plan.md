

# Plano: "Falaê Brasil! Inglês Transversal" — LMS Proprietário

## Visão Geral

Transformar o projeto atual (ClassRoomAI) em uma plataforma LMS completa de ensino de inglês com sidebar de navegação, dashboard com progresso visual, laboratório de pronúncia e biblioteca digital.

## Design System

- **Paleta "Modern Consultant"**: Azul marinho profundo (primary), teal/cyan (accent para inovação), verde esmeralda (success/gamificação), fundo branco limpo
- **Tipografia**: Inter (já disponível via Tailwind), headings bold, corpo clean
- **Componentes**: Shadcn/UI com cards arredondados, sombras sutis, badges coloridos por nível (A1-B2)

## Estrutura de Páginas e Rotas

```text
/                  → Dashboard (visão geral, progresso, XP)
/courses           → Meus Cursos (trilhas Adults/Teens/Kids, A1-B2)
/voice-lab         → Laboratório de Voz (Pronúncia Transversal)
/library           → Biblioteca BST (E-books & Audiobooks)
/community         → Comunidade (placeholder)
```

## Arquitetura de Componentes

### 1. Layout com Sidebar (Shadcn Sidebar)
- `AppSidebar` com ícones: Dashboard, Meus Cursos, Laboratório de Voz, Biblioteca BST, Comunidade
- Logo "Falaê Brasil!" no topo
- Indicador de XP/nível no rodapé da sidebar
- Collapsible com trigger sempre visível

### 2. Dashboard (`/`)
- Cards de resumo: XP total, nível de fluência, aulas concluídas, streak
- Barra de progresso visual por trilha (A1→B2)
- Próximas aulas sugeridas
- Dados mockados (sem backend por enquanto)

### 3. Meus Cursos (`/courses`)
- Tabs: Adults, Teens, Kids
- Grid de cards de curso com nível (A1-B2), progresso %, ícone de lock/unlock
- Cada card mostra módulos e progresso

### 4. Laboratório de Voz (`/voice-lab`) — CORE
- **Toggle Scripted / Unscripted** (tabs ou switch)
- **Modo Scripted**: Exibe texto fixo para leitura, botão de gravar, card de feedback
- **Modo Unscripted**: Tema sugerido, gravação livre, card de feedback
- **Card de Feedback** com 4 métricas circulares: Pronúncia, Fluência, Gramática, Vocabulário (notas 0-100, mockadas)
- Reutiliza hook `useAudioRecorder` existente para gravação
- Preparação para Whisper API (já implementada no hook)

### 5. Biblioteca BST (`/library`)
- Grid de cards: E-books e Audiobooks
- Filtros por nível e tipo
- Cards com capa, título, autor, badge de nível
- Dados mockados

### 6. Comunidade (`/community`)
- Placeholder com "Em breve"

## PWA (Sem service worker)
- Apenas `manifest.json` com ícones e `display: standalone` para instalação mobile
- Meta tags PWA no `index.html`
- Sem `vite-plugin-pwa` (seguindo diretrizes — sem service worker complexo)

## Gamificação (Visual)
- Componente `XPBadge` exibindo nível e pontos
- Progress bar de nível na sidebar
- Badges de conquista nos cards de curso
- Tudo mockado com dados estáticos

## Arquivos a Criar/Editar

| Arquivo | Ação |
|---------|------|
| `src/components/AppSidebar.tsx` | Criar — sidebar com navegação |
| `src/components/AppLayout.tsx` | Criar — layout wrapper com SidebarProvider |
| `src/pages/Dashboard.tsx` | Criar — dashboard com cards de progresso |
| `src/pages/Courses.tsx` | Criar — trilhas de cursos |
| `src/pages/VoiceLab.tsx` | Criar — laboratório de pronúncia |
| `src/pages/Library.tsx` | Criar — biblioteca BST |
| `src/pages/Community.tsx` | Criar — placeholder comunidade |
| `src/components/FeedbackCard.tsx` | Criar — card de feedback com 4 métricas |
| `src/components/XPBadge.tsx` | Criar — badge de gamificação |
| `src/components/ScoreCircle.tsx` | Criar — indicador circular de nota |
| `src/App.tsx` | Editar — adicionar rotas |
| `src/index.css` | Editar — ajustar paleta para a marca |
| `index.html` | Editar — título, meta tags PWA |
| `public/manifest.json` | Criar — manifest PWA |

## Nota sobre Backend

Toda a interface será com dados mockados. A arquitetura Supabase (usuários, trilhas, XP, biblioteca) será implementada em fase futura quando o backend for configurado. O hook de gravação de áudio e integração Whisper já existem e serão reutilizados no Laboratório de Voz.

