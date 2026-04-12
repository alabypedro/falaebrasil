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
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopLevelMonitor = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startLevelMonitor = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      // RMS-like average
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      // Normalize to 0-100
      setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
      startLevelMonitor(stream);

      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch {
      alert("Permissão de microfone necessária para gravar áudio.");
    }
  }, [startLevelMonitor]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopLevelMonitor();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [stopLevelMonitor]);

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
    audioLevel,
    startRecording,
    stopRecording,
    deleteRecording,
    transcribeRecording,
  };
}
