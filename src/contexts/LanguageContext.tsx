import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "pt" | "en";

type Dict = Record<string, { pt: string; en: string }>;

const dict: Dict = {
  // Header
  "header.theme.light": { pt: "Modo claro", en: "Light mode" },
  "header.theme.dark": { pt: "Modo escuro", en: "Dark mode" },
  "header.language": { pt: "Trocar idioma", en: "Switch language" },
  "header.signout": { pt: "Sair", en: "Sign out" },
  "header.upgrade": { pt: "Upgrade de plano", en: "Upgrade plan" },

  // Sidebar nav
  "nav.dashboard": { pt: "Painel", en: "Dashboard" },
  "nav.courses": { pt: "Cursos Falaê Brasil! (FB)", en: "Falaê Brasil! Courses (FB)" },
  "nav.memorizae": { pt: "IA Memorizaê", en: "AI Memorizaê" },
  "nav.voice": { pt: "IA Falaê", en: "AI Falaê" },
  "nav.listening": { pt: "IA Escutaê", en: "AI Escutaê" },
  "nav.writing": { pt: "IA Escreveaê", en: "AI Escreveaê" },
  "nav.leiae": { pt: "IA Leiaê", en: "AI Leiaê" },
  "nav.library": { pt: "Biblioteca BST", en: "BST Library" },
  "nav.communities": { pt: "Comunidades FB", en: "FB Communities" },
  "nav.tutorials": { pt: "Tutoriais", en: "Tutorials" },
  "nav.contracts": { pt: "Contratos", en: "Contracts" },
  "nav.install": { pt: "Instalar App", en: "Install App" },
  "nav.admin": { pt: "Admin", en: "Admin" },
  "sidebar.subtitle": { pt: "Inglês Transversal", en: "Transversal English" },

  // Dashboard
  "dashboard.title": { pt: "Painel", en: "Dashboard" },
  "dashboard.welcome": {
    pt: "Bem-vindo de volta! Continue sua jornada de aprendizado.",
    en: "Welcome back! Continue your learning journey.",
  },
  "dashboard.xp": { pt: "XP Total", en: "Total XP" },
  "dashboard.level": { pt: "Nível de Fluência", en: "Fluency Level" },
  "dashboard.gpa": { pt: "Sua Nota Média", en: "Your Average Grade" },
  "dashboard.completed": { pt: "Aulas Concluídas", en: "Completed Lessons" },
  "dashboard.progress": { pt: "Progresso por Curso", en: "Progress by Course" },
  "dashboard.cta.badge": { pt: "Pratique agora", en: "Practice now" },
  "dashboard.cta.title": { pt: "Pratique sua pronúncia agora!", en: "Practice your pronunciation now!" },
  "dashboard.cta.desc": {
    pt: "Acesse o IA Falaê e melhore sua fluência com feedback em tempo real.",
    en: "Open AI Falaê and improve your fluency with real-time feedback.",
  },
  "dashboard.cta.btn": { pt: "Ir ao IA Falaê", en: "Go to AI Falaê" },

  // Courses page
  "courses.title": { pt: "Cursos Falaê Brasil! (FB)", en: "Falaê Brasil! Courses (FB)" },
  "courses.subtitle": { pt: "Trilhas de aprendizado — seu progresso em tempo real.", en: "Learning tracks — your progress in real time." },
  "courses.group.adults": { pt: "Adultos (18+)", en: "Adults (18+)" },
  "courses.group.teens": { pt: "TEENS (13 - 17 ANOS)", en: "TEENS (13 - 17 YEARS)" },
  "courses.group.kids": { pt: "KIDS (8 - 12 ANOS)", en: "KIDS (8 - 12 YEARS)" },
  "courses.empty": { pt: "Nenhum curso publicado.", en: "No courses published." },

  // VoiceLab
  "voice.subtitle": { pt: "Pratique sua pronúncia e receba feedback detalhado com IA.", en: "Practice your pronunciation and get detailed AI feedback." },
  "voice.consumption": { pt: "Consumo de IA", en: "AI Usage" },
  "voice.scripted.label": { pt: "Scripted (leitura/repetição)", en: "Scripted (read/repeat)" },
  "voice.unscripted.label": { pt: "Unscripted (conversação livre)", en: "Unscripted (free conversation)" },
  "voice.activeCourse": { pt: "Curso ativo", en: "Active course" },
  "voice.activeCourse.hint": { pt: "As frases abaixo são apenas do curso selecionado.", en: "The phrases below are only from the selected course." },
  "voice.choosePhrase": { pt: "Escolha uma frase", en: "Choose a phrase" },
  "voice.readAloud": { pt: "Leia em voz alta:", en: "Read aloud:" },
  "voice.clickToRecord": { pt: "Clique para gravar", en: "Click to record" },
  "voice.analyzing": { pt: "Analisando…", en: "Analyzing…" },
  "voice.balanceEmpty": { pt: "Saldo esgotado", en: "Balance exhausted" },
  "voice.recording.free": { pt: "Fale livremente… clique para parar", en: "Speak freely… click to stop" },
  "voice.recording.normal": { pt: "Gravando… clique para parar", en: "Recording… click to stop" },
  "voice.micVolume": { pt: "Volume do Microfone", en: "Microphone Volume" },
  "voice.level.low": { pt: "Muito baixo", en: "Too low" },
  "voice.level.high": { pt: "Muito alto", en: "Too high" },
  "voice.level.ideal": { pt: "Ideal", en: "Ideal" },
  "voice.newPractice": { pt: "Nova Prática", en: "New Practice" },
  "voice.analyzingPronunciation": { pt: "Analisando pronúncia…", en: "Analyzing pronunciation…" },
  "voice.suggestedTopic": { pt: "Tema Sugerido", en: "Suggested Topic" },
  "voice.generatingTopic": { pt: "Gerando tema com IA…", en: "Generating topic with AI…" },
  "voice.newTopic": { pt: "Novo tema", en: "New topic" },
  "voice.backToLesson": { pt: "Voltar à lição", en: "Back to lesson" },
  "voice.practicingLesson": { pt: "Praticando a lição:", en: "Practicing lesson:" },
  "voice.noPhrases": { pt: "ainda não tem frases para o IA Falaê.", en: "doesn't have phrases for AI Falaê yet." },
  "voice.selectCoursePrompt": { pt: "Selecione um curso acima para ver as frases disponíveis.", en: "Select a course above to see available phrases." },
  "voice.selectCoursePlaceholder": { pt: "Selecione um curso", en: "Select a course" },
  "voice.scriptedExhausted": { pt: "Saldo de Scripted esgotado. Adquira novos módulos para continuar praticando.", en: "Scripted balance exhausted. Get new modules to keep practicing." },
  "voice.unscriptedExhausted": { pt: "Saldo de Unscripted esgotado. Adquira novos módulos para continuar praticando.", en: "Unscripted balance exhausted. Get new modules to keep practicing." },

  // FeedbackCard
  "feedback.recordPrompt": { pt: "Grave um áudio para receber seu feedback de pronúncia", en: "Record audio to receive your pronunciation feedback" },

  // ListeningLab list
  "listening.subtitle": { pt: "Escolha uma lição para praticar sua compreensão auditiva.", en: "Pick a lesson to practice your listening comprehension." },
  "listening.startPractice": { pt: "Começar Prática", en: "Start Practice" },
  "listening.loading": { pt: "Carregando lições...", en: "Loading lessons..." },
  "listening.empty": { pt: "Nenhuma lição encontrada para o nível", en: "No lessons found for level" },

  // ListeningLab — lesson player
  "listening.backToLesson": { pt: "Voltar à lição", en: "Back to lesson" },
  "listening.partOf": { pt: "Parte {n} de 4", en: "Part {n} of 4" },
  "listening.questionOf": { pt: "Questão {n} de 10", en: "Question {n} of 10" },
  "listening.title.photo": { pt: "Descrição de Foto", en: "Photo Description" },
  "listening.title.qa": { pt: "Pergunta & Resposta", en: "Question & Answer" },
  "listening.title.dialogue": { pt: "Mini Diálogo", en: "Mini Dialogue" },
  "listening.title.essay": { pt: "Mini Dissertação", en: "Mini Essay" },
  "listening.desc.photo": { pt: "Analise a imagem e ouça as alternativas. Escolha a que melhor descreve a foto.", en: "Analyze the image and listen to the options. Choose the one that best describes the photo." },
  "listening.desc.qa": { pt: "Ouça a pergunta e as alternativas. Escolha a resposta mais adequada.", en: "Listen to the question and the options. Choose the most appropriate answer." },
  "listening.desc.dialogue": { pt: "Ouça o diálogo e responda às questões de interpretação.", en: "Listen to the dialogue and answer the comprehension questions." },
  "listening.desc.essay": { pt: "Ouça a dissertação e responda às questões de interpretação.", en: "Listen to the essay and answer the comprehension questions." },
  "listening.alternative": { pt: "Alternativa", en: "Option" },
  "listening.answer": { pt: "Resposta", en: "Answer" },
  "listening.listenAudio": { pt: "Ouvir Áudio", en: "Listen to Audio" },
  "listening.listenQuestion": { pt: "Ouça a Pergunta", en: "Listen to the Question" },
  "listening.listenDialogue": { pt: "Ouvir Diálogo", en: "Listen to Dialogue" },
  "listening.listenDialogueLoading": { pt: "Ouvindo Diálogo...", en: "Listening to Dialogue..." },
  "listening.listenEssay": { pt: "Ouvir Dissertação", en: "Listen to Essay" },
  "listening.listenEssayLoading": { pt: "Ouvindo Dissertação...", en: "Listening to Essay..." },
  "listening.interpretation": { pt: "QUESTÃO DE INTERPRETAÇÃO", en: "INTERPRETATION QUESTION" },
  "listening.nextQuestion": { pt: "Próxima Questão", en: "Next Question" },
  "listening.finishPractice": { pt: "Finalizar Prática", en: "Finish Practice" },
  "listening.finished": { pt: "Prática Finalizada!", en: "Practice Finished!" },
  "listening.completedAll": { pt: "Você completou as 10 questões da lição.", en: "You completed all 10 questions of the lesson." },
  "listening.yourScore": { pt: "SUA PONTUAÇÃO", en: "YOUR SCORE" },
  "listening.backToLessons": { pt: "Voltar para Lições", en: "Back to Lessons" },
  "listening.tryAgain": { pt: "Tentar Novamente", en: "Try Again" },
  "listening.review": { pt: "Revisão da Prática", en: "Practice Review" },
  "listening.yours": { pt: "Sua:", en: "Yours:" },
  "listening.correctLabel": { pt: "Correta:", en: "Correct:" },
  "listening.notAnswered": { pt: "Não respondida", en: "Not answered" },
  "listening.tryAnother": { pt: "Tentar Outra Lição", en: "Try Another Lesson" },

  // ChatBase (writing / listening shared)
  "writing.subtitle": { pt: "Pratique sua escrita com IA e receba correções em tempo real.", en: "Practice your writing with AI and get real-time corrections." },
  "listeningChat.subtitle": { pt: "Pratique sua compreensão com IA.", en: "Practice your comprehension with AI." },
  "chat.suggestedTopic": { pt: "Tema Sugerido", en: "Suggested Topic" },
  "chat.generatingTopic": { pt: "Gerando tema com IA…", en: "Generating topic with AI…" },
  "chat.loadingTopic": { pt: "Carregando tema...", en: "Loading topic..." },
  "chat.newTopic": { pt: "Novo tema", en: "New topic" },
  "chat.startWriting": { pt: "Inicie uma conversa para começar a praticar!", en: "Start a conversation to begin practicing!" },
  "chat.startListening": { pt: "Start a conversation to begin practicing!", en: "Start a conversation to begin practicing!" },
  "chat.placeholder.writing": { pt: "Escreva seu texto (máx. {n} palavras)...", en: "Write your text (max. {n} words)..." },
  "chat.placeholder.listening": { pt: "Write something...", en: "Write something..." },
  "chat.words": { pt: "palavras", en: "words" },
  "chat.hint": { pt: "Enter envia • Shift+Enter quebra linha", en: "Enter sends • Shift+Enter new line" },

  // Library
  "library.title": { pt: "Biblioteca BST", en: "BST Library" },
  "library.subtitle": { pt: "Brasil Sem Trava: E-books e Audiobooks para complementar seu aprendizado.", en: "Brasil Sem Trava: E-books and Audiobooks to complement your learning." },

  // Communities
  "communities.title": { pt: "Comunidades FB", en: "FB Communities" },
  "communities.subtitle": { pt: "Acesse os grupos de WhatsApp dos alunos Falaê Brasil!", en: "Access the WhatsApp groups of Falaê Brasil! students." },
  "communities.teacher.title": { pt: "Aula particular com o professor", en: "Private class with the teacher" },
  "communities.teacher.desc": { pt: "Chat direto 1:1 com o professor. Disponível apenas para alunos VIP.", en: "Direct 1:1 chat with the teacher. Available for VIP students only." },
  "communities.chat": { pt: "Conversar", en: "Chat" },
  "communities.folder": { pt: "Comunidades FB", en: "FB Communities" },

  // Tutoriais
  "tutorials.title": { pt: "Tutoriais", en: "Tutorials" },
  "tutorials.subtitle": { pt: "Aprenda a aproveitar ao máximo o Falaê Brasil! com nossos vídeos guiados.", en: "Learn to make the most of Falaê Brasil! with our guided videos." },
  "tutorials.watch": { pt: "Assistir", en: "Watch" },
  "tutorials.soon": { pt: "Vídeo em breve", en: "Video coming soon" },
  "tutorials.t.install.title": { pt: "Como instalar o aplicativo", en: "How to install the app" },
  "tutorials.t.install.desc": { pt: "Adicione o Falaê Brasil! à tela inicial do seu celular ou computador.", en: "Add Falaê Brasil! to your phone or computer home screen." },
  "tutorials.t.credits.title": { pt: "Como usar os créditos de IA", en: "How to use AI credits" },
  "tutorials.t.credits.desc": { pt: "Entenda como funcionam os minutos de prática Scripted e Unscripted.", en: "Understand how Scripted and Unscripted practice minutes work." },
  "tutorials.t.nav.title": { pt: "Navegando pelos cursos", en: "Navigating the courses" },
  "tutorials.t.nav.desc": { pt: "Aprenda a percorrer módulos, aulas e quizzes do Falaê Brasil!", en: "Learn to navigate modules, lessons and quizzes of Falaê Brasil!" },
  "tutorials.t.xp.title": { pt: "Acompanhando seu XP e Nível", en: "Tracking your XP and Level" },
  "tutorials.t.xp.desc": { pt: "Veja como ganhar XP, subir de nível e manter sua streak.", en: "See how to earn XP, level up and keep your streak." },
  "tutorials.t.library.title": { pt: "Biblioteca BST", en: "BST Library" },
  "tutorials.t.library.desc": { pt: "Como acessar ebooks, áudios e materiais complementares.", en: "How to access ebooks, audios and supplementary materials." },
  "tutorials.t.community.title": { pt: "Comunidades FB", en: "FB Communities" },
  "tutorials.t.community.desc": { pt: "Acesse os grupos de WhatsApp e pratique com outros alunos do Falaê Brasil!", en: "Access the WhatsApp groups and practice with other Falaê Brasil! students." },

  // Contratos
  "contracts.title": { pt: "Contratos", en: "Contracts" },
  "contracts.subtitle": { pt: "Visualize e baixe os contratos modelo de cada hierarquia de plano.", en: "View and download the template contracts for each plan tier." },
  "contracts.modelPrefix": { pt: "Contrato Modelo", en: "Template Contract" },
  "contracts.notAvailable": { pt: "Contrato ainda não disponível.", en: "Contract not available yet." },
  "contracts.open": { pt: "Abrir contrato", en: "Open contract" },
  "contracts.loading": { pt: "Carregando...", en: "Loading..." },

  // Install
  "install.back": { pt: "Voltar", en: "Back" },
  "install.title": { pt: "Instale o Falaê Brasil", en: "Install Falaê Brasil" },
  "install.subtitle": { pt: "Acesse o app direto da tela inicial do seu celular ou desktop, com experiência fullscreen e mais rápida.", en: "Open the app right from your phone or desktop home screen, with a fullscreen and faster experience." },
  "install.previewWarn.title": { pt: "A instalação não funciona dentro do editor/preview.", en: "Installation doesn't work inside the editor/preview." },
  "install.previewWarn.body1": { pt: "Abra o app publicado em", en: "Open the published app at" },
  "install.previewWarn.body2": { pt: "no seu celular ou navegador para instalar.", en: "on your phone or browser to install." },
  "install.ios.title": { pt: "iPhone / iPad (Safari)", en: "iPhone / iPad (Safari)" },
  "install.ios.desc": { pt: "No iPhone/iPad a instalação é manual — a Apple não permite um botão automático. Siga os passos abaixo no Safari.", en: "On iPhone/iPad installation is manual — Apple doesn't allow an automatic button. Follow the steps below in Safari." },
  "install.ios.step1.a": { pt: "Abra este site no", en: "Open this site in" },
  "install.ios.step1.b": { pt: "(não funciona em outros navegadores).", en: "(doesn't work in other browsers)." },
  "install.ios.step2.a": { pt: "Toque no ícone", en: "Tap the" },
  "install.ios.step2.b": { pt: "Menu", en: "Menu" },
  "install.ios.step2.c": { pt: "na barra inferior.", en: "icon on the bottom bar." },
  "install.ios.step3.a": { pt: "Toque no ícone", en: "Tap the" },
  "install.ios.step3.b": { pt: "Compartilhar", en: "Share" },
  "install.ios.step3.c": { pt: ".", en: "icon." },
  "install.ios.step4.a": { pt: "Role e toque em", en: "Scroll and tap" },
  "install.ios.step4.b": { pt: "Adicionar à Tela de Início", en: "Add to Home Screen" },
  "install.ios.step5.a": { pt: "Confirme em", en: "Confirm with" },
  "install.ios.step5.b": { pt: "Adicionar", en: "Add" },
  "install.ios.step5.c": { pt: ". O app aparecerá na sua tela inicial.", en: ". The app will appear on your home screen." },
  "install.android.title": { pt: "Android (Chrome)", en: "Android (Chrome)" },
  "install.android.step1.a": { pt: "Toque no ícone", en: "Tap the" },
  "install.android.step1.b": { pt: "Instalar agora", en: "Install now" },
  "install.android.step1.c": { pt: "ou", en: "or" },
  "install.android.step1.d": { pt: "Instalar Falaê Brasil!", en: "Install Falaê Brasil!" },
  "install.android.step2.a": { pt: "Toque em", en: "Tap" },
  "install.android.step2.b": { pt: "Instalar", en: "Install" },
  "install.android.step2.c": { pt: ".", en: "." },
  "install.desktop.title": { pt: "Computador (Chrome/Edge)", en: "Computer (Chrome/Edge)" },
  "install.desktop.step1.a": { pt: "Clique no ícone", en: "Click the" },
  "install.desktop.step2.a": { pt: "Clique e confirme em", en: "Click and confirm" },
  "install.desktop.step2.c": { pt: ". O Falaê Brasil abrirá em uma janela própria.", en: ". Falaê Brasil will open in its own window." },
  "install.device": { pt: "Seu dispositivo", en: "Your device" },
  "install.installed": { pt: "O app já está instalado neste dispositivo.", en: "The app is already installed on this device." },
  "install.quick.title": { pt: "Instalação rápida", en: "Quick install" },
  "install.quick.desc": { pt: "Seu navegador suporta instalação direta. Clique no botão abaixo.", en: "Your browser supports direct install. Click the button below." },
  "install.button": { pt: "Instalar Falaê Brasil", en: "Install Falaê Brasil" },
  "install.installNow": { pt: "Instalar agora", en: "Install now" },
  "install.hint": { pt: "Dica: a instalação só funciona no app publicado, não dentro do editor.", en: "Tip: install only works on the published app, not inside the editor." },

  // Common
  "common.backToDashboard": { pt: "Voltar ao Painel", en: "Back to Dashboard" },
  "common.back": { pt: "Voltar", en: "Back" },

  // Memorizae
  "memorizae.subtitle": {
    pt: "Treino diário de flashcards com Repetição Espaçada (SRS). O algoritmo escolhe o momento perfeito para você revisar cada carta e destruir a Curva do Esquecimento — 5 a 10 minutos por dia bastam.",
    en: "Daily flashcard training with Spaced Repetition (SRS). The algorithm picks the perfect moment for you to review each card and destroy the Forgetting Curve — 5 to 10 minutes a day is enough.",
  },
  "memorizae.mastered": { pt: "Cartas dominadas", en: "Mastered cards" },
  "memorizae.inDeck": { pt: "No seu deck", en: "In your deck" },
  "memorizae.dueNow": { pt: "Devidas agora", en: "Due now" },
  "memorizae.decksAvailable": { pt: "Decks disponíveis", en: "Available decks" },
  "memorizae.listenRepeat": { pt: "Ouça e Repita", en: "Listen and Repeat" },
  "memorizae.listen": { pt: "Ouvir", en: "Listen" },
  "memorizae.showAnswer": { pt: "Mostrar resposta", en: "Show answer" },
  "memorizae.again": { pt: "Novamente", en: "Again" },
  "memorizae.hard": { pt: "Difícil", en: "Hard" },
  "memorizae.good": { pt: "Bom", en: "Good" },
  "memorizae.easy": { pt: "Fácil", en: "Easy" },
  "memorizae.reviewed": { pt: "Revisadas", en: "Reviewed" },
  "memorizae.sessionDone": { pt: "Sessão concluída!", en: "Session complete!" },
  "memorizae.finish": { pt: "Concluir", en: "Finish" },

  // Leiaê
  "leiae.badge": { pt: "Leitura Técnica Interativa", en: "Interactive Technical Reading" },
  "leiae.subtitle": {
    pt: "Decifre relatórios de auditoria, e-mails da matriz e guias de embarque de forma independente. Clique em qualquer palavra para ver tradução, sílabas, imagem e áudio.",
    en: "Decipher audit reports, headquarters emails, and boarding guides independently. Click any word to see translation, syllables, image, and audio.",
  },
  "leiae.feature.translation": { pt: "Tradução PT-BR instantânea", en: "Instant PT-BR translation" },
  "leiae.feature.audio": { pt: "Áudio palavra por palavra", en: "Word-by-word audio" },
  "leiae.feature.syllables": { pt: "Divisão silábica", en: "Syllable breakdown" },
  "leiae.feature.images": { pt: "Imagens de suporte", en: "Support images" },
  "leiae.textsByLevel": { pt: "Textos disponíveis por nível", en: "Texts available by level" },
  "leiae.pasteOwnText": { pt: "Ou cole seu próprio texto", en: "Or paste your own text" },
  "leiae.titlePlaceholder": { pt: "Título (opcional) — ex.: Auditoria Q3", en: "Title (optional) — e.g., Q3 Audit" },
  "leiae.contentPlaceholder": { pt: "Cole aqui o relatório, e-mail ou guia em inglês…", en: "Paste the report, email or guide in English here…" },
  "leiae.open": { pt: "Abrir IA Leiaê", en: "Open AI Leiaê" },
  "leiae.opening": { pt: "Abrindo IA Leiaê…", en: "Opening AI Leiaê…" },
};

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("language") as Language | null;
      if (stored === "pt" || stored === "en") return stored;
    }
    return "pt";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState((p) => (p === "pt" ? "en" : "pt"));

  const t = (key: string, fallback?: string) => {
    const entry = dict[key];
    if (!entry) return fallback ?? key;
    return entry[language];
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}