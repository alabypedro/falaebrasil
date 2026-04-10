import { useState, useRef, useCallback } from "react";

export interface Recording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  transcription?: string;
  isTranscribing?: boolean;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const recording: Recording = {
          id: crypto.randomUUID(),
          blob,
          url,
          duration,
          timestamp: new Date(),
        };
        setRecordings((prev) => [recording, ...prev]);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(250);
      startTimeRef.current = Date.now();
      setElapsed(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch {
      alert("Permissão de microfone necessária para gravar áudio.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const rec = prev.find((r) => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const transcribeRecording = useCallback(
    async (id: string, apiKey: string) => {
      const rec = recordings.find((r) => r.id === id);
      if (!rec) return;

      setRecordings((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isTranscribing: true } : r))
      );

      try {
        const formData = new FormData();
        formData.append("file", rec.blob, "audio.webm");
        formData.append("model", "whisper-1");
        formData.append("language", "pt");

        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        });

        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const data = await res.json();

        setRecordings((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, transcription: data.text, isTranscribing: false } : r
          )
        );
      } catch (err) {
        setRecordings((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, isTranscribing: false, transcription: "Erro na transcrição." } : r
          )
        );
      }
    },
    [recordings]
  );

  return {
    isRecording,
    recordings,
    elapsed,
    startRecording,
    stopRecording,
    deleteRecording,
    transcribeRecording,
  };
}
