import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Headphones, Play, Pause, RotateCcw, CheckCircle2, ChevronRight, ChevronLeft, Mic, Image as ImageIcon, MessageSquare, FileText, Loader2, Volume2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import BackToLessonButton from "@/components/BackToLessonButton";
import BackToDashboardButton from "@/components/BackToDashboardButton";
import { useLanguage } from "@/contexts/LanguageContext";

interface ListeningLesson {
  id: string;
  title: string;
  description: string;
  level: string;
  content: any;
}

import { useAuth } from "@/contexts/AuthContext";
import { LEVEL_LIST } from "@/lib/levels";

export default function ListeningLab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [lessons, setLessons] = useState<ListeningLesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<ListeningLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("A1");
  const [searchParams] = useSearchParams();
  const [autoStarted, setAutoStarted] = useState(false);
  
  // Game state
  const [currentPart, setCurrentPart] = useState<1 | 2 | 3 | 4>(1);
  const [currentQuestionInPart, setCurrentQuestionInPart] = useState(0); // 0-indexed
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [correctMap, setCorrectMap] = useState<Record<string, number>>({});
  const [showDetails, setShowDetails] = useState(false);
  
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
      const { data, error } = await supabase.rpc("get_listening_lessons_public" as any);
      if (data) setLessons(data as ListeningLesson[]);
      setLoading(false);
    };
    fetchLessons();
  }, []);

  // Apply level filter from URL
  useEffect(() => {
    const lvl = searchParams.get('level');
    if (lvl && LEVEL_LIST.includes(lvl)) {
      setFilterLevel(lvl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select a lesson matching ?unit=N&level=XX
  useEffect(() => {
    if (autoStarted || loading || lessons.length === 0) return;
    const unit = searchParams.get('unit');
    const lvl = searchParams.get('level');
    if (!unit) return;
    const unitNum = parseInt(unit, 10);
    if (!unitNum) return;
    const pool = lvl ? lessons.filter(l => l.level === lvl) : lessons;
    const re = new RegExp(`\\bunit\\s*0*${unitNum}\\b`, 'i');
    const match = pool.find(l => re.test(l.title));
    if (match) {
      setAutoStarted(true);
      startLesson(match);
    }
  }, [lessons, loading, searchParams, autoStarted]);

  const startLesson = (lesson: ListeningLesson) => {
    setSelectedLesson(lesson);
    setCurrentPart(1);
    setCurrentQuestionInPart(0);
    setAnswers({});
    setFinished(false);
    setScore(0);
    setCorrectMap({});
    setShowDetails(false);
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
    if (!selectedLesson) return;
    const { data, error } = await supabase.rpc("grade_listening_lesson" as any, {
      _lesson_id: selectedLesson.id,
      _answers: answers as any,
    });
    if (error || !data) {
      toast.error("Erro ao calcular nota: " + (error?.message ?? "desconhecido"));
      return;
    }
    const result = data as any;
    setScore(result.score ?? 0);
    setCorrectMap((result.correct_answers ?? {}) as Record<string, number>);
    setFinished(true);
    try {
      await supabase.rpc("update_best_score" as any, {
        _kind: "listening",
        _value: result.score ?? 0,
      });
    } catch {}
    try {
      const { awardAiXp } = await import("@/lib/aiXp");
      const pts = Math.max(1, Math.min(25, Math.round((result.score ?? 0) / 4)));
      const res = await awardAiXp("escutae", pts, `escutae:${selectedLesson.id}:${Date.now()}`);
      if (res?.awarded) toast.success(`+${res.points} XP · IA Escutaê`);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{t("listening.loading")}</p>
      </div>
    );
  }

  if (!selectedLesson) {
    const levels = LEVEL_LIST;
    const filteredLessons = (filterLevel === "all" 
      ? lessons 
      : lessons.filter(l => l.level === filterLevel))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <BackToDashboardButton className="-ml-2 mb-2 text-muted-foreground hover:text-foreground" />
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="text-4xl font-black tracking-tight">IA Escutaê</h1>
              <BackToLessonButton className="shrink-0" />
            </div>
            <p className="text-muted-foreground">{t("listening.subtitle")}</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
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
            <p className="text-xl font-medium text-muted-foreground">{t("listening.empty")} {filterLevel}.</p>
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
                    {t("listening.startPractice")} 
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
        question: t("listening.title.photo"),
        userAnswer: answers['1-0'],
        correctAnswer: correctMap['1-0'],
        options: content.part1.options.map((o: any) => `${t("listening.alternative")} ${String.fromCharCode(65 + content.part1.options.indexOf(o))}`)
      },
      ...content.part2.map((q: any, i: number) => ({
        question: `${t("listening.title.qa")} ${i + 1}`,
        userAnswer: answers[`2-${i}`],
        correctAnswer: correctMap[`2-${i}`],
        options: q.options.map((o: any, idx: number) => `${t("listening.answer")} ${String.fromCharCode(65 + idx)}`)
      })),
      ...content.part3.questions.map((q: any, i: number) => ({
        question: q.enunciado,
        userAnswer: answers[`3-${i}`],
        correctAnswer: correctMap[`3-${i}`],
        options: q.options
      })),
      ...content.part4.questions.map((q: any, i: number) => ({
        question: q.enunciado,
        userAnswer: answers[`4-${i}`],
        correctAnswer: correctMap[`4-${i}`],
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
          <h2 className="text-4xl font-black mb-2 tracking-tight">{t("listening.finished")}</h2>
          <p className="text-muted-foreground mb-8 text-lg">{t("listening.completedAll")}</p>
          
          <div className="bg-muted/30 p-8 rounded-2xl mb-8 border border-white/5 inline-block min-w-[300px]">
            <p className="text-xs uppercase text-muted-foreground font-black tracking-widest mb-2">{t("listening.yourScore")}</p>
            <p className="text-7xl font-black text-primary flex items-baseline justify-center gap-2">
              {score} <span className="text-3xl text-muted-foreground/50 font-medium">/ 100</span>
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Button variant="outline" size="lg" className="rounded-full px-8" onClick={() => setSelectedLesson(null)}>
              {t("listening.backToLessons")}
            </Button>
            <Button size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20" onClick={() => startLesson(selectedLesson)}>
              {t("listening.tryAgain")}
            </Button>
          </div>
          <div className="mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails((v) => !v)}
              className="rounded-full"
            >
              {showDetails ? "Ocultar detalhes" : "Ver detalhes das notas"}
            </Button>
          </div>
        </Card>

        {showDetails && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold px-2">{t("listening.review")}</h3>
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
                      {/* Questões 1 a 4: mostra SÓ a resposta correta quando erra; quando acerta, não mostra resposta. Questões 5 a 10: mostra sempre. */}
                      {idx >= 4 ? (
                        <div className="space-y-1 text-sm">
                          <p className={cn(
                            "flex items-center gap-2",
                            isCorrect ? "text-green-500/90" : "text-red-500/90"
                          )}>
                            <span className="font-semibold">{t("listening.yours")}</span> {q.options[q.userAnswer] || t("listening.notAnswered")}
                          </p>
                          <p className="text-muted-foreground flex items-center gap-2">
                            <span className="font-semibold">{t("listening.correctLabel")}</span> {q.options[q.correctAnswer] ?? "—"}
                          </p>
                        </div>
                      ) : !isCorrect ? (
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground flex items-center gap-2">
                            <span className="font-semibold">{t("listening.correctLabel")}</span> {q.options[q.correctAnswer] ?? "—"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        <div className="flex justify-center pt-8">
          <Button 
            variant="ghost" 
            className="gap-2 text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setSelectedLesson(null)}
          >
            <RotateCcw className="h-4 w-4" /> {t("listening.tryAnother")}
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
          <p className="text-sm text-muted-foreground">{t("listening.partOf").replace("{n}", String(currentPart))}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => {
          synth.cancel();
          const url = sessionStorage.getItem("ai-return-url");
          if (url) {
            sessionStorage.removeItem("ai-return-url");
            navigate(url);
          } else {
            setSelectedLesson(null);
          }
        }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("listening.backToLesson")}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>{t("listening.questionOf").replace("{n}", String(Math.min(Object.keys(answers).length + 1, 10)))}</span>
          <span>{Math.round((Object.keys(answers).length / 10) * 100)}%</span>
        </div>
        <Progress value={(Object.keys(answers).length / 10) * 100} className="h-2" />
      </div>

      <Card className="min-h-[400px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentPart === 1 && <><ImageIcon className="h-5 w-5" /> {t("listening.title.photo")}</>}
            {currentPart === 2 && <><Mic className="h-5 w-5" /> {t("listening.title.qa")}</>}
            {currentPart === 3 && <><MessageSquare className="h-5 w-5" /> {t("listening.title.dialogue")}</>}
            {currentPart === 4 && <><FileText className="h-5 w-5" /> {t("listening.title.essay")}</>}
          </CardTitle>
          <CardDescription>
            {currentPart === 1 && t("listening.desc.photo")}
            {currentPart === 2 && t("listening.desc.qa")}
            {currentPart === 3 && t("listening.desc.dialogue")}
            {currentPart === 4 && t("listening.desc.essay")}
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
                      <span className="text-lg font-bold">{t("listening.alternative")} {String.fromCharCode(65 + i)}</span>
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
                      {t("listening.listenAudio")}
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
                <span className="text-xs font-bold uppercase">{t("listening.listenQuestion")}</span>
              </Button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                {currentContent.part2[currentQuestionInPart].options.map((opt: any, i: number) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Button 
                      variant={currentAnswer === i ? "default" : "outline"} 
                      className="h-24 flex-col gap-2 relative"
                      onClick={() => handleAnswer(i)}
                    >
                      <span className="text-lg font-bold">{t("listening.answer")} {String.fromCharCode(65 + i)}</span>
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
                      {t("listening.listenAudio")}
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
                  {isSpeaking ? t("listening.listenDialogueLoading") : t("listening.listenDialogue")}
                </Button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30">
                  <h4 className="font-bold text-sm mb-3">{t("listening.interpretation")}</h4>
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
                  {isSpeaking ? t("listening.listenEssayLoading") : t("listening.listenEssay")}
                </Button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30">
                  <h4 className="font-bold text-sm mb-3">{t("listening.interpretation")}</h4>
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
            {currentPart === 4 && currentQuestionInPart === 2 ? t("listening.finishPractice") : t("listening.nextQuestion")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}