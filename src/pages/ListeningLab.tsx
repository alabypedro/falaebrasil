import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Headphones, Play, Pause, RotateCcw, CheckCircle2, ChevronRight, ChevronLeft, Mic, Image as ImageIcon, MessageSquare, FileText, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface ListeningLesson {
  id: string;
  title: string;
  description: string;
  level: string;
  content: any;
}

import { useAuth } from "@/contexts/AuthContext";

export default function ListeningLab() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<ListeningLesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<ListeningLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  
  // Game state
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3 | 4>(1);
  const [currentQuestionInPart, setCurrentQuestionInPart] = useState(0); // 0-indexed
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  
  // Audio state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  
  const synth = window.speechSynthesis;

  useEffect(() => {
    // Load voices immediately
    const loadVoices = () => {
      synth.getVoices();
    };
    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    const fetchLessons = async () => {
      const { data, error } = await supabase.from("listening_lessons").select("*").order("created_at");
      if (data) setLessons(data);
      setLoading(false);
    };
    fetchLessons();
  }, []);

  const startLesson = (lesson: ListeningLesson) => {
    setSelectedLesson(lesson);
    setCurrentPart(1);
    setCurrentQuestionInPart(0);
    setAnswers({});
    setFinished(false);
    setScore(0);
    synth.cancel();
  };

  const getVoice = (gender: 'male' | 'female' = 'female') => {
    const voices = synth.getVoices();
    // Prefer Google/Premium English voices as they tend to be more "humanized"
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    
    // Sort to prioritize high quality/natural voices if available
    const sortedVoices = [...englishVoices].sort((a, b) => {
      const premiumKeywords = ['Google', 'Premium', 'Natural', 'Enhanced', 'Neural'];
      const aScore = premiumKeywords.reduce((acc, kw) => acc + (a.name.includes(kw) ? 1 : 0), 0);
      const bScore = premiumKeywords.reduce((acc, kw) => acc + (b.name.includes(kw) ? 1 : 0), 0);
      return bScore - aScore;
    });

    if (gender === 'female') {
      return sortedVoices.find(v => 
        v.name.includes('Female') || 
        v.name.includes('Zira') || 
        v.name.includes('Samantha') || 
        v.name.includes('Google US English') ||
        v.name.includes('Microsoft Aria')
      ) || sortedVoices[0];
    } else {
      return sortedVoices.find(v => 
        v.name.includes('Male') || 
        v.name.includes('David') || 
        v.name.includes('Google UK English Male') ||
        v.name.includes('Microsoft Guy')
      ) || sortedVoices[0];
    }
  };

  const speak = (text: string, voiceType: 'male' | 'female' = 'female', id: string) => {
    if (currentAudioId === id && isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      setCurrentAudioId(null);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    
    const voice = getVoice(voiceType);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.85; // Slightly slower for better clarity and less robotic feel
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentAudioId(id);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentAudioId(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentAudioId(null);
    };

    synth.speak(utterance);
  };

  const playDialogue = async (dialogue: { speaker: string, text: string }[]) => {
    synth.cancel();
    for (const line of dialogue) {
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(line.text);
        utterance.lang = "en-US";
        const voice = getVoice(line.speaker === 'female' ? 'female' : 'male');
        if (voice) utterance.voice = voice;
        utterance.rate = 0.85;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synth.speak(utterance);
      });
    }
    setIsSpeaking(false);
  };

  const handleAnswer = (choice: number) => {
    const questionKey = `${currentPart}-${currentQuestionInPart}`;
    setAnswers(prev => ({ ...prev, [questionKey]: choice }));
  };

  const nextQuestion = () => {
    synth.cancel();
    if (currentPart === 1) {
      setCurrentPart(2);
      setCurrentQuestionInPart(0);
    } else if (currentPart === 2) {
      if (currentQuestionInPart < 2) {
        setCurrentQuestionInPart(prev => prev + 1);
      } else {
        setCurrentPart(3);
        setCurrentQuestionInPart(0);
      }
    } else if (currentPart === 3) {
      if (currentQuestionInPart < 2) {
        setCurrentQuestionInPart(prev => prev + 1);
      } else {
        setCurrentPart(4);
        setCurrentQuestionInPart(0);
      }
    } else if (currentPart === 4) {
      if (currentQuestionInPart < 2) {
        setCurrentQuestionInPart(prev => prev + 1);
      } else {
        calculateResult();
      }
    }
  };

  const calculateResult = async () => {
    let totalCorrect = 0;
    const content = selectedLesson!.content;

    // Part 1
    if (answers['1-0'] === content.part1.correct_index) totalCorrect++;

    // Part 2
    for (let i = 0; i < 3; i++) {
      if (answers[`2-${i}`] === content.part2[i].correct_index) totalCorrect++;
    }

    // Part 3
    for (let i = 0; i < 3; i++) {
      if (answers[`3-${i}`] === content.part3.questions[i].correct_index) totalCorrect++;
    }

    // Part 4
    for (let i = 0; i < 3; i++) {
      if (answers[`4-${i}`] === content.part4.questions[i].correct_index) totalCorrect++;
    }

    const calculatedScore = totalCorrect * 10;
    setScore(calculatedScore);
    setFinished(true);

    if (user) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("best_listening_score")
          .eq("user_id", user.id)
          .maybeSingle();

        const currentBest = profile?.best_listening_score || 0;
        if (calculatedScore > currentBest) {
          await supabase
            .from("profiles")
            .update({ best_listening_score: calculatedScore })
            .eq("user_id", user.id);
        }
      } catch (err) {
        console.error("Error updating best listening score:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Carregando lições...</p>
      </div>
    );
  }

  if (!selectedLesson) {
    const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    const filteredLessons = filterLevel === "all" 
      ? lessons 
      : lessons.filter(l => l.level === filterLevel);

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-4xl font-black tracking-tight mb-2">IA Escutaê</h1>
            <p className="text-muted-foreground">Escolha uma lição para praticar sua compreensão auditiva.</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={filterLevel === "all" ? "default" : "outline"} 
              size="sm"
              onClick={() => setFilterLevel("all")}
              className="rounded-full px-4"
            >
              Todos
            </Button>
            {levels.map(lvl => (
              <Button 
                key={lvl}
                variant={filterLevel === lvl ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilterLevel(lvl)}
                className="rounded-full px-4"
              >
                {lvl}
              </Button>
            ))}
          </div>
        </div>

        {filteredLessons.length === 0 ? (
          <Card className="p-16 text-center border-dashed bg-muted/30">
            <Headphones className="h-16 w-16 mx-auto text-muted-foreground opacity-20 mb-4" />
            <p className="text-xl font-medium text-muted-foreground">Nenhuma lição encontrada para o nível {filterLevel}.</p>
            {filterLevel !== "all" && (
              <Button variant="link" onClick={() => setFilterLevel("all")} className="mt-2 text-primary">
                Ver todas as lições
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {filteredLessons.map((lesson) => (
              <Card 
                key={lesson.id} 
                className="hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 cursor-pointer transition-all duration-300 group flex flex-col border-white/5 bg-card/50 backdrop-blur-sm" 
                onClick={() => startLesson(lesson)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-wider border border-primary/20">
                      {lesson.level}
                    </span>
                    <div className="p-2 rounded-full bg-muted/50 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                      <Headphones className="h-4 w-4" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors leading-tight mb-2">
                    {lesson.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                    {lesson.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto pt-4 border-t border-white/5">
                  <Button variant="ghost" className="w-full justify-between hover:bg-primary hover:text-white transition-all group/btn">
                    Começar Prática 
                    <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (finished) {
    const content = selectedLesson.content;
    const questionsList = [
      {
        question: "Descrição de Foto",
        userAnswer: answers['1-0'],
        correctAnswer: content.part1.correct_index,
        options: content.part1.options.map((o: any) => `Alternativa ${String.fromCharCode(65 + content.part1.options.indexOf(o))}`)
      },
      ...content.part2.map((q: any, i: number) => ({
        question: `Pergunta & Resposta ${i + 1}`,
        userAnswer: answers[`2-${i}`],
        correctAnswer: q.correct_index,
        options: q.options.map((o: any, idx: number) => `Resposta ${String.fromCharCode(65 + idx)}`)
      })),
      ...content.part3.questions.map((q: any, i: number) => ({
        question: q.enunciado,
        userAnswer: answers[`3-${i}`],
        correctAnswer: q.correct_index,
        options: q.options
      })),
      ...content.part4.questions.map((q: any, i: number) => ({
        question: q.enunciado,
        userAnswer: answers[`4-${i}`],
        correctAnswer: q.correct_index,
        options: q.options
      }))
    ];

    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <Card className="text-center p-8 bg-card/50 backdrop-blur-sm border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
              <CheckCircle2 className="h-12 w-12" />
            </div>
          </div>
          <h2 className="text-4xl font-black mb-2 tracking-tight">Prática Finalizada!</h2>
          <p className="text-muted-foreground mb-8 text-lg">Você completou as 10 questões da lição.</p>
          
          <div className="bg-muted/30 p-8 rounded-2xl mb-8 border border-white/5 inline-block min-w-[300px]">
            <p className="text-xs uppercase text-muted-foreground font-black tracking-widest mb-2">SUA PONTUAÇÃO</p>
            <p className="text-7xl font-black text-primary flex items-baseline justify-center gap-2">
              {score} <span className="text-3xl text-muted-foreground/50 font-medium">/ 10</span>
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Button variant="outline" size="lg" className="rounded-full px-8" onClick={() => setSelectedLesson(null)}>
              Voltar para Lições
            </Button>
            <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20" onClick={() => startLesson(selectedLesson)}>
              Tentar Novamente
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <h3 className="text-xl font-bold px-2">Revisão da Prática</h3>
          <div className="grid gap-4">
            {questionsList.map((q, idx) => {
              const isCorrect = q.userAnswer === q.correctAnswer;
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "p-6 rounded-2xl border transition-all duration-300",
                    isCorrect 
                      ? "bg-green-500/5 border-green-500/20" 
                      : "bg-red-500/5 border-red-500/20"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "mt-1 p-1.5 rounded-full border shrink-0",
                      isCorrect ? "text-green-500 border-green-500/20 bg-green-500/10" : "text-red-500 border-red-500/20 bg-red-500/10"
                    )}>
                      {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="font-bold text-lg leading-tight">{idx + 1}. {q.question}</p>
                      <div className="space-y-1 text-sm">
                        <p className={cn(
                          "flex items-center gap-2",
                          isCorrect ? "text-green-500/90" : "text-red-500/90"
                        )}>
                          <span className="font-semibold">Sua:</span> {q.options[q.userAnswer] || "Não respondida"}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-2">
                          <span className="font-semibold">Correta:</span> {isCorrect ? q.options[q.correctAnswer] : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center pt-8">
          <Button 
            variant="ghost" 
            className="gap-2 text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setSelectedLesson(null)}
          >
            <RotateCcw className="h-4 w-4" /> Tentar Outra Lição
          </Button>
        </div>
      </div>
    );
  }

  const currentContent = selectedLesson.content;
  const currentAnswer = answers[`${currentPart}-${currentQuestionInPart}`];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{selectedLesson.title}</h2>
          <p className="text-sm text-muted-foreground">Parte {currentPart} de 4</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { synth.cancel(); setSelectedLesson(null); }}>Sair</Button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>Questão {Math.min(Object.keys(answers).length + 1, 10)} de 10</span>
          <span>{Math.round((Object.keys(answers).length / 10) * 100)}%</span>
        </div>
        <Progress value={(Object.keys(answers).length / 10) * 100} className="h-2" />
      </div>

      <Card className="min-h-[400px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentPart === 1 && <><ImageIcon className="h-5 w-5" /> Descrição de Foto</>}
            {currentPart === 2 && <><Mic className="h-5 w-5" /> Pergunta & Resposta</>}
            {currentPart === 3 && <><MessageSquare className="h-5 w-5" /> Mini Diálogo</>}
            {currentPart === 4 && <><FileText className="h-5 w-5" /> Mini Dissertação</>}
          </CardTitle>
          <CardDescription>
            {currentPart === 1 && "Analise a imagem e ouça as alternativas. Escolha a que melhor descreve a foto."}
            {currentPart === 2 && "Ouça a pergunta e as alternativas. Escolha a resposta mais adequada."}
            {currentPart === 3 && "Ouça o diálogo e responda às questões de interpretação."}
            {currentPart === 4 && "Ouça a dissertação e responda às questões de interpretação."}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 space-y-6">
          {currentPart === 1 && currentContent.part1 && (
            <div className="space-y-6">
              <div className="aspect-video relative rounded-lg overflow-hidden bg-muted border">
                {currentContent.part1.image_url ? (
                  <img src={currentContent.part1.image_url} alt="Questão" className="object-cover w-full h-full" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">Sem imagem</div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(currentContent.part1.options || []).map((opt: any, i: number) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Button 
                      variant={currentAnswer === i ? "default" : "outline"} 
                      className="h-24 flex-col gap-2 relative"
                      onClick={() => handleAnswer(i)}
                    >
                      <span className="text-lg font-bold">Alternativa {String.fromCharCode(65 + i)}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full gap-2",
                        currentAudioId === `p1-o-${i}` ? "text-primary animate-pulse" : "text-muted-foreground"
                      )}
                      onClick={() => speak(opt.script, 'female', `p1-o-${i}`)}
                    >
                      <Volume2 className="h-4 w-4" />
                      Ouvir Áudio
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentPart === 2 && (
            <div className="space-y-8 flex flex-col items-center py-8">
              <Button 
                variant="outline" 
                size="lg" 
                className="h-32 w-32 rounded-full flex-col gap-2 border-2"
                onClick={() => speak(currentContent.part2[currentQuestionInPart].question_script, 'male', `p2-q-${currentQuestionInPart}`)}
              >
                <div className={cn(
                  "p-4 rounded-full",
                  currentAudioId === `p2-q-${currentQuestionInPart}` ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground"
                )}>
                  <Volume2 className="h-8 w-8" />
                </div>
                <span className="text-xs font-bold uppercase">Ouça a Pergunta</span>
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                {currentContent.part2[currentQuestionInPart].options.map((opt: any, i: number) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Button 
                      variant={currentAnswer === i ? "default" : "outline"} 
                      className="h-24 flex-col gap-2 relative"
                      onClick={() => handleAnswer(i)}
                    >
                      <span className="text-lg font-bold">Resposta {String.fromCharCode(65 + i)}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full gap-2",
                        currentAudioId === `p2-q-${currentQuestionInPart}-o-${i}` ? "text-primary animate-pulse" : "text-muted-foreground"
                      )}
                      onClick={() => speak(opt.script, 'female', `p2-q-${currentQuestionInPart}-o-${i}`)}
                    >
                      <Volume2 className="h-4 w-4" />
                      Ouvir Áudio
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentPart === 3 && (
            <div className="space-y-8">
              <div className="flex justify-center py-4">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="gap-2 border-2 h-16 px-8"
                  disabled={isSpeaking}
                  onClick={() => playDialogue(currentContent.part3.dialogue)}
                >
                  {isSpeaking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Volume2 className="h-5 w-5" />}
                  {isSpeaking ? "Ouvindo Diálogo..." : "Ouvir Diálogo"}
                </Button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30">
                  <h4 className="font-bold text-sm mb-3">QUESTÃO DE INTERPRETAÇÃO</h4>
                  <p className="text-lg font-medium mb-4">{currentContent.part3.questions[currentQuestionInPart].enunciado}</p>
                  <div className="space-y-2">
                    {currentContent.part3.questions[currentQuestionInPart].options.map((opt: string, i: number) => (
                      <Button 
                        key={i} 
                        variant={currentAnswer === i ? "default" : "outline"} 
                        className="w-full justify-start h-auto py-3 px-4 text-left whitespace-normal"
                        onClick={() => handleAnswer(i)}
                      >
                        <span className="mr-3 font-bold">{String.fromCharCode(65 + i)})</span> {opt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentPart === 4 && (
            <div className="space-y-8">
              <div className="flex justify-center py-4">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="gap-2 border-2 h-16 px-8"
                  disabled={isSpeaking}
                  onClick={() => speak(currentContent.part4.script, 'female', 'p4-script')}
                >
                  {isSpeaking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Volume2 className="h-5 w-5" />}
                  {isSpeaking ? "Ouvindo Dissertação..." : "Ouvir Dissertação"}
                </Button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30">
                  <h4 className="font-bold text-sm mb-3">QUESTÃO DE INTERPRETAÇÃO</h4>
                  <p className="text-lg font-medium mb-4">{currentContent.part4.questions[currentQuestionInPart].enunciado}</p>
                  <div className="space-y-2">
                    {currentContent.part4.questions[currentQuestionInPart].options.map((opt: string, i: number) => (
                      <Button 
                        key={i} 
                        variant={currentAnswer === i ? "default" : "outline"} 
                        className="w-full justify-start h-auto py-3 px-4 text-left whitespace-normal"
                        onClick={() => handleAnswer(i)}
                      >
                        <span className="mr-3 font-bold">{String.fromCharCode(65 + i)})</span> {opt}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="border-t pt-6">
          <Button 
            className="w-full py-6 text-lg" 
            disabled={currentAnswer === undefined}
            onClick={nextQuestion}
          >
            {currentPart === 4 && currentQuestionInPart === 2 ? "Finalizar Prática" : "Próxima Questão"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}