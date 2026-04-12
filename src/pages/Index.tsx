import { useState } from "react";
import { BookOpen, Key, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import LessonCard from "@/components/LessonCard";
import AudioRecorder from "@/components/AudioRecorder";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

const LESSONS = [
  {
    id: "1",
    title: "Introdução à Consultoria Estratégica",
    description: "Fundamentos e frameworks essenciais para análise de negócios e criação de valor.",
    duration: "45 min",
    category: "Estratégia",
  },
  {
    id: "2",
    title: "Análise de Mercado e Competitividade",
    description: "Ferramentas para mapear concorrentes, identificar oportunidades e posicionar-se.",
    duration: "30 min",
    category: "Mercado",
  },
  {
    id: "3",
    title: "Gestão de Projetos Ágeis",
    description: "Metodologias ágeis aplicadas a projetos de consultoria e transformação digital.",
    duration: "50 min",
    category: "Gestão",
  },
  {
    id: "4",
    title: "Comunicação com Stakeholders",
    description: "Técnicas de apresentação executiva e influência para consultores.",
    duration: "35 min",
    category: "Soft Skills",
  },
];

export default function Index() {
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const { isRecording, recordings, elapsed, startRecording, stopRecording, deleteRecording, transcribeRecording } =
    useAudioRecorder();

  const selectedLesson = LESSONS.find((l) => l.id === activeLesson);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              ClassRoom<span className="text-accent">AI</span>
            </h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowApiKey((v) => !v)} title="Configurar API Key">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* API Key bar */}
      {showApiKey && (
        <div className="border-b bg-secondary/50">
          <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <Key className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              type="password"
              placeholder="Cole sua OpenAI API Key aqui (sk-...)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="max-w-md"
            />
            <span className="text-xs text-muted-foreground hidden sm:block">Necessária para transcrição Whisper</span>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Lessons panel */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Aulas</h2>
              <p className="text-sm text-muted-foreground mt-1">Selecione uma aula e grave notas em áudio</p>
            </div>
            <div className="space-y-3">
              {LESSONS.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  {...lesson}
                  isActive={activeLesson === lesson.id}
                  onClick={() => setActiveLesson(lesson.id)}
                />
              ))}
            </div>
          </div>

          {/* Recording panel */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border bg-card shadow-sm p-6 lg:p-8 space-y-6 lg:sticky lg:top-24">
              {selectedLesson ? (
                <>
                  <div>
                    <p className="text-xs font-semibold text-accent uppercase tracking-wider">
                      {selectedLesson.category}
                    </p>
                    <h2 className="text-xl font-bold text-foreground mt-1">{selectedLesson.title}</h2>
                    <p className="text-sm text-muted-foreground mt-2">{selectedLesson.description}</p>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Gravador de Áudio</h3>
                    <AudioRecorder
                      isRecording={isRecording}
                      elapsed={elapsed}
                      recordings={recordings}
                      onStart={startRecording}
                      onStop={stopRecording}
                      onDelete={deleteRecording}
                      onTranscribe={(id) => {
                        if (!apiKey) {
                          setShowApiKey(true);
                          alert("Insira sua OpenAI API Key primeiro.");
                          return;
                        }
                        transcribeRecording(id, apiKey);
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary mb-4">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground">Nenhuma aula selecionada</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Escolha uma aula ao lado para começar a gravar suas notas em áudio
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
