import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Video, FileText, Mic, Eye, MessageSquareText, Headphones } from "lucide-react";
import { PdfReader } from "@/components/library/PdfReader";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface LessonPreviewProps {
  lesson: {
    title: string;
    description: string | null;
    video_url: string | null;
    pdf_url: string | null;
    practice_text: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LessonPreview({ lesson, open, onOpenChange }: LessonPreviewProps) {
  const [showPdf, setShowPdf] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold">{lesson.title}</DialogTitle>
              <Badge variant="outline">Visualização do Aluno</Badge>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {lesson.video_url && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Video className="h-4 w-4 text-primary" /> Videoaula Principal
                  </div>
                  <div className="aspect-video w-full rounded-xl overflow-hidden border shadow-lg bg-black">
                    <iframe
                      src={lesson.video_url}
                      className="w-full h-full"
                      allowFullScreen
                      title={lesson.title}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-primary" /> Descrição e Materiais
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {lesson.description || "Nenhuma descrição disponível para esta lição."}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    {lesson.pdf_url && (
                      <div className="p-4 rounded-xl border bg-muted/30 flex items-center justify-between group hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-red-100 text-red-600">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Material Complementar (PDF)</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Download disponível</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setShowPdf(true)} className="gap-2">
                          <Eye className="h-4 w-4" /> Visualizar
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="w-full gap-2 justify-start h-12">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <div className="text-left">
                          <div className="text-xs font-semibold">IA Escreveaê</div>
                          <div className="text-[10px] text-muted-foreground">Praticar Escrita</div>
                        </div>
                      </Button>
                      
                      <Button variant="outline" className="w-full gap-2 justify-start h-12">
                        <Headphones className="h-4 w-4 text-primary" />
                        <div className="text-left">
                          <div className="text-xs font-semibold">IA Escutaê</div>
                          <div className="text-[10px] text-muted-foreground">Praticar Audição</div>
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>

                {lesson.practice_text && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Mic className="h-4 w-4 text-primary" /> IA Falaê
                    </div>
                    <div className="p-6 rounded-xl border bg-primary/5 italic text-lg leading-relaxed shadow-inner">
                      "{lesson.practice_text}"
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Este texto será carregado automaticamente no laboratório de voz.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {lesson.pdf_url && (
        <PdfReader 
          url={lesson.pdf_url} 
          title={lesson.title} 
          isOpen={showPdf} 
          onClose={() => setShowPdf(false)} 
        />
      )}
    </>
  );
}
