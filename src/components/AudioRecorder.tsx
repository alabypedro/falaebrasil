import { Mic, Square, Trash2, FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Recording } from "@/hooks/useAudioRecorder";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface AudioRecorderProps {
  isRecording: boolean;
  elapsed: number;
  recordings: Recording[];
  onStart: () => void;
  onStop: () => void;
  onDelete: (id: string) => void;
  onTranscribe: (id: string) => void;
}

export default function AudioRecorder({
  isRecording,
  elapsed,
  recordings,
  onStart,
  onStop,
  onDelete,
  onTranscribe,
}: AudioRecorderProps) {
  return (
    <div className="space-y-6">
      {/* Record button */}
      <div className="flex flex-col items-center gap-3">
        {isRecording ? (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse-recording" />
              <Button
                size="lg"
                variant="destructive"
                className="relative h-20 w-20 rounded-full"
                onClick={onStop}
              >
                <Square className="h-7 w-7" />
              </Button>
            </div>
            <span className="text-sm font-mono text-destructive font-semibold">
              {formatTime(elapsed)}
            </span>
            <span className="text-xs text-muted-foreground">Gravando… clique para parar</span>
          </>
        ) : (
          <>
            <Button
              size="lg"
              className="h-20 w-20 rounded-full"
              onClick={onStart}
            >
              <Mic className="h-7 w-7" />
            </Button>
            <span className="text-xs text-muted-foreground">Clique para gravar</span>
          </>
        )}
      </div>

      {/* Recordings list */}
      {recordings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Gravações</h3>
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="rounded-lg border bg-card p-4 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                    <Mic className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {rec.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatTime(rec.duration)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => onTranscribe(rec.id)}
                    disabled={rec.isTranscribing || !!rec.transcription}
                    title="Transcrever"
                  >
                    {rec.isTranscribing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </Button>
                  <a href={rec.url} download={`gravacao-${rec.id.slice(0, 6)}.webm`}>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Baixar">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(rec.id)}
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <audio src={rec.url} controls className="w-full h-9" />

              {rec.transcription && (
                <div className="rounded-md bg-secondary p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Transcrição</p>
                  <p className="text-sm text-foreground leading-relaxed">{rec.transcription}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
